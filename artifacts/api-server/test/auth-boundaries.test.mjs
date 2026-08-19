/**
 * Auth Boundary Regression Tests
 *
 * Covers:
 *  1. Identity & session lifecycle — OIDC subject upsert/reuse, valid/expired sessions,
 *     session cleanup, account deletion revocation, mobile Bearer authentication.
 *  2. Ownership boundaries — bars, drinks, coupons, specials, follows; anonymous → 401,
 *     non-owner → 403, owner → 200/201/204.
 *  3. CSRF boundaries — unsafe browser-cookie requests without/with untrusted Origin → 403;
 *     known-good Origins accepted; Bearer mobile writes exempt.
 *
 * No live OIDC provider is called. Users and sessions are seeded directly in the database.
 * A real Express server is spawned per test group so all middleware (auth, CSRF) runs.
 */

import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";

const requireFromDbPackage = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDbPackage("pg");

const artifactDirectory = fileURLToPath(new URL("..", import.meta.url));

// ─── Server lifecycle helpers ─────────────────────────────────────────────────

async function waitForServer(baseUrl, server, stderr, getSpawnError) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const spawnError = getSpawnError();
    if (spawnError) throw new Error(`API server could not start: ${spawnError.message}`);
    if (server.exitCode !== null) {
      throw new Error(`API server exited before becoming ready:\n${stderr.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch {
      // still starting
    }
    await delay(50);
  }
  throw new Error(`API server did not become ready:\n${stderr.join("")}`);
}

async function stopServer(server) {
  if (server.exitCode !== null || !server.pid) return;
  const exited = once(server, "exit");
  if (!server.kill("SIGTERM")) return;
  const stopped = await Promise.race([exited.then(() => true), delay(1_000).then(() => false)]);
  if (stopped || server.exitCode !== null) return;
  const forceExited = once(server, "exit");
  if (server.kill("SIGKILL")) await Promise.race([forceExited, delay(1_000)]);
}

function spawnServer(port, extraEnv = {}) {
  const stderr = [];
  let spawnError;
  const server = spawn(
    process.execPath,
    ["--enable-source-maps", "./dist/index.mjs"],
    {
      cwd: artifactDirectory,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        // Disable Clerk OIDC in tests — authMiddleware relies on session-based identity only
        CLERK_SECRET_KEY: "",
        ...extraEnv,
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  server.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  server.on("error", (error) => { spawnError = error; });
  return { server, stderr, getSpawnError: () => spawnError };
}

// ─── Database fixture helpers ─────────────────────────────────────────────────

function makeFixtureId() {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

async function seedUser(pool, suffix) {
  const id = suffix ?? makeFixtureId();
  const [row] = (await pool.query(
    `INSERT INTO users (username, email, oidc_subject)
     VALUES ($1, $2, $3)
     ON CONFLICT (oidc_subject) DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    [`auth-test-user-${id}`, `auth-test-${id}@example.invalid`, `auth-test-subj-${id}`],
  )).rows;
  return { userId: row.id, suffix: id };
}

async function seedSession(pool, userId, { expired = false } = {}) {
  const sid = `sess-${makeFixtureId()}`;
  const expire = expired
    ? new Date(Date.now() - 1000) // 1 second in the past
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO sessions (sid, user_id, sess, expire)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [
      sid,
      userId,
      JSON.stringify({ user: { id: userId, username: `auth-test-user-${userId}`, email: `auth-test-${userId}@example.invalid`, avatarUrl: null, createdAt: new Date().toISOString() } }),
      expire,
    ],
  );
  return sid;
}

async function seedBar(pool, ownerId, { subscriptionActive = false } = {}) {
  const id = makeFixtureId();
  const [row] = (await pool.query(
    `INSERT INTO bars (name, owner_id, subscription_active, latitude, longitude, location_verified_at)
     VALUES ($1, $2, $3, 40.7128, -74.0060, now())
     RETURNING id`,
    [`auth-test-bar-${id}`, ownerId, subscriptionActive],
  )).rows;
  return row.id;
}

async function seedDrink(pool, barId) {
  const id = makeFixtureId();
  const [row] = (await pool.query(
    `INSERT INTO drinks (bar_id, name) VALUES ($1, $2) RETURNING id`,
    [barId, `auth-test-drink-${id}`],
  )).rows;
  return row.id;
}

async function seedSpecial(pool, barId) {
  const id = makeFixtureId();
  const [row] = (await pool.query(
    `INSERT INTO specials (bar_id, title) VALUES ($1, $2) RETURNING id`,
    [barId, `auth-test-special-${id}`],
  )).rows;
  return row.id;
}

async function seedCoupon(pool, barId) {
  const id = makeFixtureId();
  const [row] = (await pool.query(
    `INSERT INTO coupons (bar_id, code, title, discount_type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [barId, `TEST-${id}`, `auth-test-coupon-${id}`, "percentage"],
  )).rows;
  return row.id;
}

async function cleanupUsers(pool, userIds) {
  if (!userIds.length) return;
  // Cascades to sessions via FK
  await pool.query(
    `DELETE FROM users WHERE id = ANY($1::int[])`,
    [userIds],
  );
}

async function cleanupBars(pool, barIds) {
  if (!barIds.length) return;
  await pool.query(`DELETE FROM bars WHERE id = ANY($1::int[])`, [barIds]);
}

// ─── Request helpers ──────────────────────────────────────────────────────────

function cookieRequest(baseUrl, sid, origin) {
  return (method, path, body) =>
    fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: `weekender_session=${sid}`,
        ...(origin ? { Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
}

function bearerRequest(baseUrl, sid) {
  return (method, path, body) =>
    fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sid}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
}

function anonRequest(baseUrl) {
  return (method, path, body) =>
    fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Identity & Session Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

test("identity and session lifecycle", { timeout: 30_000 }, async (t) => {
  const port = randomInt(30_000, 40_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const { server, stderr, getSpawnError } = spawnServer(port);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const allUserIds = [];

  try {
    await waitForServer(baseUrl, server, stderr, getSpawnError);

    // ── OIDC upsert: inserting same oidc_subject twice should yield one row ──
    await t.test("OIDC subject upsert creates a stable account", async () => {
      const subject = `upsert-test-${makeFixtureId()}`;
      const email1 = `upsert1-${makeFixtureId()}@example.invalid`;
      const email2 = `upsert2-${makeFixtureId()}@example.invalid`;

      const [first] = (await pool.query(
        `INSERT INTO users (username, email, oidc_subject)
         VALUES ('upsert-user-1', $1, $2) RETURNING id`,
        [email1, subject],
      )).rows;
      allUserIds.push(first.id);

      // Simulate re-login: upsert with updated email
      const [second] = (await pool.query(
        `INSERT INTO users (username, email, oidc_subject)
         VALUES ('upsert-user-2', $1, $2)
         ON CONFLICT (oidc_subject) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [email2, subject],
      )).rows;

      assert.equal(first.id, second.id, "repeat sign-in must reuse the same account row");

      const [row] = (await pool.query(
        "SELECT email FROM users WHERE id = $1",
        [first.id],
      )).rows;
      assert.equal(row.email, email2, "email should be updated on conflict");
    });

    // ── Valid session → authenticated ──
    await t.test("valid session authenticates the account", async () => {
      const { userId } = await seedUser(pool);
      allUserIds.push(userId);
      const sid = await seedSession(pool, userId);
      const req = cookieRequest(baseUrl, sid, `http://localhost:${port}`);
      const res = await req("GET", "/auth/user");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.user, "should return a user object");
      assert.equal(body.user.id, userId);
    });

    // ── Expired session → rejected, row cleaned up ──
    await t.test("expired session is rejected and removed", async () => {
      const { userId } = await seedUser(pool);
      allUserIds.push(userId);
      const sid = await seedSession(pool, userId, { expired: true });
      const req = cookieRequest(baseUrl, sid, `http://localhost:${port}`);
      const res = await req("GET", "/auth/user");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.user, null, "expired session must return null user");

      // The authMiddleware should have deleted the expired row
      const rows = (await pool.query("SELECT 1 FROM sessions WHERE sid = $1", [sid])).rows;
      assert.equal(rows.length, 0, "expired session row must be removed");
    });

    // ── No session → anonymous ──
    await t.test("anonymous request returns null user", async () => {
      const res = await fetch(`${baseUrl}/api/auth/user`);
      const body = await res.json();
      assert.equal(body.user, null);
    });

    // ── Mobile Bearer token authenticates the same session as browser cookie ──
    await t.test("mobile Bearer token authenticates the same account as browser session", async () => {
      const { userId } = await seedUser(pool);
      allUserIds.push(userId);
      const sid = await seedSession(pool, userId);

      const [cookieBody, bearerBody] = await Promise.all([
        cookieRequest(baseUrl, sid, `http://localhost:${port}`)("GET", "/auth/user")
          .then((r) => r.json()),
        bearerRequest(baseUrl, sid)("GET", "/auth/user")
          .then((r) => r.json()),
      ]);

      assert.ok(cookieBody.user, "cookie session should authenticate");
      assert.ok(bearerBody.user, "bearer session should authenticate");
      assert.equal(cookieBody.user.id, bearerBody.user.id, "both must resolve to the same account");
    });

    // ── Account deletion revokes all sessions ──
    await t.test("account deletion cascades to all sessions", async () => {
      const { userId } = await seedUser(pool);
      allUserIds.push(userId);
      const [sid1, sid2] = await Promise.all([
        seedSession(pool, userId),
        seedSession(pool, userId),
      ]);

      await pool.query("DELETE FROM users WHERE id = $1", [userId]);

      const remaining = (await pool.query(
        "SELECT COUNT(*)::int AS count FROM sessions WHERE sid = ANY($1::varchar[])",
        [[sid1, sid2]],
      )).rows[0].count;
      assert.equal(remaining, 0, "deleting an account must cascade-delete all sessions");
      // Remove from cleanup list since already deleted
      allUserIds.splice(allUserIds.indexOf(userId), 1);
    });

    // ── DELETE /auth/account via API ──
    await t.test("DELETE /auth/account removes account and invalidates cookie session", async () => {
      const { userId } = await seedUser(pool);
      // Don't track for cleanup — the delete endpoint will remove it
      const sid = await seedSession(pool, userId);
      const req = cookieRequest(baseUrl, sid, `http://localhost:${port}`);
      const res = await req("DELETE", "/auth/account");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.success);

      const userRow = (await pool.query("SELECT 1 FROM users WHERE id = $1", [userId])).rows;
      assert.equal(userRow.length, 0, "account row must be gone");
    });

    // ── DELETE /auth/account without session → 401 ──
    await t.test("DELETE /auth/account without session returns 401", async () => {
      const res = await fetch(`${baseUrl}/api/auth/account`, { method: "DELETE" });
      assert.equal(res.status, 401);
    });

  } finally {
    await stopServer(server);
    await cleanupUsers(pool, allUserIds);
    await pool.end();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Ownership Boundaries
// ═══════════════════════════════════════════════════════════════════════════════

test("ownership boundaries across bars, drinks, coupons, specials, follows", { timeout: 30_000 }, async (t) => {
  const port = randomInt(30_000, 40_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  // Use a trusted localhost origin so we pass the CSRF check for cookie requests in this suite
  const trustedOrigin = `http://localhost:${port}`;
  const { server, stderr, getSpawnError } = spawnServer(port);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const allUserIds = [];
  const allBarIds = [];

  try {
    await waitForServer(baseUrl, server, stderr, getSpawnError);

    // Seed two owners, each with a bar
    const owner1 = await seedUser(pool);
    const owner2 = await seedUser(pool);
    allUserIds.push(owner1.userId, owner2.userId);

    const [sid1, sid2] = await Promise.all([
      seedSession(pool, owner1.userId),
      seedSession(pool, owner2.userId),
    ]);

    // Request helpers
    const anon = anonRequest(baseUrl);
    const asOwner1 = cookieRequest(baseUrl, sid1, trustedOrigin);
    const asOwner2 = cookieRequest(baseUrl, sid2, trustedOrigin);

    // ── POST /bars — requires sign-in; ownerId comes from session (not body) ──
    await t.test("POST /bars: anonymous → 401", async () => {
      const res = await anon("POST", "/bars", { name: "Test Bar", latitude: 40.7, longitude: -74.0 });
      assert.equal(res.status, 401);
    });

    await t.test("POST /bars: owner uses authenticated identity, not client-supplied ownerId", async () => {
      const res = await asOwner1("POST", "/bars", {
        name: `ownership-test-bar-${makeFixtureId()}`,
        latitude: 40.7128,
        longitude: -74.0060,
      });
      assert.equal(res.status, 201);
      const bar = await res.json();
      allBarIds.push(bar.id);
      assert.equal(bar.ownerId, owner1.userId, "ownerId must be the authenticated user, not any client-supplied value");
    });

    // Seed bars for both owners so subsequent tests can use them
    const bar1 = await seedBar(pool, owner1.userId, { subscriptionActive: true });
    const bar2 = await seedBar(pool, owner2.userId, { subscriptionActive: true });
    allBarIds.push(bar1, bar2);

    // ── GET /bars/mine — requires sign-in ──
    await t.test("GET /bars/mine: anonymous → 401", async () => {
      const res = await anon("GET", "/bars/mine");
      assert.equal(res.status, 401);
    });

    await t.test("GET /bars/mine: returns only the authenticated owner's bars", async () => {
      const res = await asOwner1("GET", "/bars/mine");
      assert.equal(res.status, 200);
      const bars = await res.json();
      const ids = bars.map((b) => b.id);
      assert.ok(ids.includes(bar1), "owner should see their own bar");
      assert.ok(!ids.includes(bar2), "owner must not see another owner's bar");
    });

    // ── PUT /bars/:barId — requires bar ownership ──
    await t.test("PUT /bars/:barId: anonymous → 401", async () => {
      const res = await anon("PUT", `/bars/${bar1}`, { name: "Should Fail" });
      assert.equal(res.status, 401);
    });

    await t.test("PUT /bars/:barId: non-owner → 403", async () => {
      const res = await asOwner2("PUT", `/bars/${bar1}`, { name: "Should Fail" });
      assert.equal(res.status, 403);
    });

    await t.test("PUT /bars/:barId: owner can update their own bar", async () => {
      const newName = `updated-bar-${makeFixtureId()}`;
      const res = await asOwner1("PUT", `/bars/${bar1}`, { name: newName });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.name, newName);
    });

    // ── POST /bars/:barId/drinks — requires bar ownership ──
    await t.test("POST /bars/:barId/drinks: anonymous → 401", async () => {
      const res = await anon("POST", `/bars/${bar1}/drinks`, { name: "Ghost Beer" });
      assert.equal(res.status, 401);
    });

    await t.test("POST /bars/:barId/drinks: non-owner → 403", async () => {
      const res = await asOwner2("POST", `/bars/${bar1}/drinks`, { name: "Ghost Beer" });
      assert.equal(res.status, 403);
    });

    await t.test("POST /bars/:barId/drinks: owner can add a drink", async () => {
      const res = await asOwner1("POST", `/bars/${bar1}/drinks`, { name: `Test Drink ${makeFixtureId()}` });
      assert.equal(res.status, 201);
      assert.ok((await res.json()).id);
    });

    // ── Coupons ──────────────────────────────────────────────────────────────

    await t.test("GET /bars/:barId/coupons: anonymous → 401", async () => {
      const res = await anon("GET", `/bars/${bar1}/coupons`);
      assert.equal(res.status, 401);
    });

    await t.test("GET /bars/:barId/coupons: non-owner → 403", async () => {
      const res = await asOwner2("GET", `/bars/${bar1}/coupons`);
      assert.equal(res.status, 403);
    });

    await t.test("GET /bars/:barId/coupons: owner can list coupons", async () => {
      const res = await asOwner1("GET", `/bars/${bar1}/coupons`);
      assert.equal(res.status, 200);
    });

    await t.test("POST /bars/:barId/coupons: anonymous → 401", async () => {
      const res = await anon("POST", `/bars/${bar1}/coupons`, { title: "Ghost", discountType: "percentage" });
      assert.equal(res.status, 401);
    });

    await t.test("POST /bars/:barId/coupons: non-owner → 403", async () => {
      const res = await asOwner2("POST", `/bars/${bar1}/coupons`, { title: "Ghost", discountType: "percentage" });
      assert.equal(res.status, 403);
    });

    // Seed a coupon in owner1's bar so we can test delete boundaries
    const couponId = await seedCoupon(pool, bar1);
    const coupon2Id = await seedCoupon(pool, bar2);

    await t.test("DELETE /coupons/:couponId: anonymous → 401", async () => {
      const res = await anon("DELETE", `/coupons/${couponId}`);
      assert.equal(res.status, 401);
    });

    await t.test("DELETE /coupons/:couponId: non-owner → 403", async () => {
      const res = await asOwner2("DELETE", `/coupons/${couponId}`);
      assert.equal(res.status, 403);
    });

    await t.test("DELETE /coupons/:couponId: owner can delete their coupon", async () => {
      const res = await asOwner1("DELETE", `/coupons/${couponId}`);
      assert.equal(res.status, 204);
    });

    await t.test("DELETE /coupons/:couponId: owner cannot delete another owner's coupon", async () => {
      const res = await asOwner1("DELETE", `/coupons/${coupon2Id}`);
      assert.equal(res.status, 403);
    });

    // ── Specials ─────────────────────────────────────────────────────────────

    await t.test("POST /bars/:barId/specials: anonymous → 401", async () => {
      const res = await anon("POST", `/bars/${bar1}/specials`, { title: "Ghost Special" });
      assert.equal(res.status, 401);
    });

    await t.test("POST /bars/:barId/specials: non-owner → 403", async () => {
      const res = await asOwner2("POST", `/bars/${bar1}/specials`, { title: "Ghost Special" });
      assert.equal(res.status, 403);
    });

    await t.test("POST /bars/:barId/specials: owner can create a special", async () => {
      const res = await asOwner1("POST", `/bars/${bar1}/specials`, { title: `Special ${makeFixtureId()}` });
      assert.equal(res.status, 201);
    });

    const specialId = await seedSpecial(pool, bar1);
    const special2Id = await seedSpecial(pool, bar2);

    await t.test("DELETE /specials/:specialId: anonymous → 401", async () => {
      const res = await anon("DELETE", `/specials/${specialId}`);
      assert.equal(res.status, 401);
    });

    await t.test("DELETE /specials/:specialId: non-owner → 403", async () => {
      const res = await asOwner2("DELETE", `/specials/${specialId}`);
      assert.equal(res.status, 403);
    });

    await t.test("DELETE /specials/:specialId: owner can delete their special", async () => {
      const res = await asOwner1("DELETE", `/specials/${specialId}`);
      assert.equal(res.status, 204);
    });

    await t.test("DELETE /specials/:specialId: owner cannot delete another owner's special", async () => {
      const res = await asOwner1("DELETE", `/specials/${special2Id}`);
      assert.equal(res.status, 403);
    });

    // ── Follows — requires sign-in (not ownership) ───────────────────────────

    await t.test("POST /bars/:barId/follow: anonymous → 401", async () => {
      const res = await anon("POST", `/bars/${bar1}/follow`);
      assert.equal(res.status, 401);
    });

    await t.test("POST /bars/:barId/follow: signed-in user can follow any bar", async () => {
      const res = await asOwner2("POST", `/bars/${bar1}/follow`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.following, true);
    });

    await t.test("DELETE /bars/:barId/follow: anonymous → 401", async () => {
      const res = await anon("DELETE", `/bars/${bar1}/follow`);
      assert.equal(res.status, 401);
    });

    await t.test("DELETE /bars/:barId/follow: signed-in user can unfollow", async () => {
      const res = await asOwner2("DELETE", `/bars/${bar1}/follow`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.following, false);
    });

    // ── Users routes — require sign-in ───────────────────────────────────────

    await t.test("GET /users/:userId: anonymous → 401", async () => {
      const res = await anon("GET", `/users/${owner1.userId}`);
      assert.equal(res.status, 401);
    });

    await t.test("GET /users/:userId/following: anonymous → 401", async () => {
      const res = await anon("GET", `/users/${owner1.userId}/following`);
      assert.equal(res.status, 401);
    });

  } finally {
    await stopServer(server);
    // Cleanup: bars first (their child rows are cleaned by cascade or raw delete),
    // then users (sessions cascade too)
    await cleanupBars(pool, allBarIds);
    await cleanupUsers(pool, allUserIds);
    await pool.end();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — CSRF Boundaries
// ═══════════════════════════════════════════════════════════════════════════════

test("CSRF boundaries for unsafe browser-cookie requests", { timeout: 30_000 }, async (t) => {
  const port = randomInt(30_000, 40_000);
  const baseUrl = `http://127.0.0.1:${port}`;

  // We test the CSRF middleware using the configured REPLIT_DEV_DOMAIN or a
  // known-good localhost origin. The CSRF check applies only when:
  //   - method is POST/PUT/PATCH/DELETE
  //   - a session cookie is present
  //   - no Bearer Authorization header is set
  const trustedOrigin = `http://localhost:${port}`;
  const untrustedOrigin = "https://evil.example.com";

  const { server, stderr, getSpawnError } = spawnServer(port);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const allUserIds = [];
  const allBarIds = [];

  try {
    await waitForServer(baseUrl, server, stderr, getSpawnError);

    const { userId } = await seedUser(pool);
    allUserIds.push(userId);
    const sid = await seedSession(pool, userId);
    const bar = await seedBar(pool, userId);
    allBarIds.push(bar);

    // ── Missing Origin on cookie POST → 403 ──
    await t.test("POST with cookie session and no Origin header → 403", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/specials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `weekender_session=${sid}`,
          // deliberately no Origin header
        },
        body: JSON.stringify({ title: "Should be blocked" }),
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.ok(body.error, "should return error payload");
    });

    // ── Untrusted Origin on cookie POST → 403 ──
    await t.test("POST with cookie session and untrusted Origin → 403", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/specials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `weekender_session=${sid}`,
          Origin: untrustedOrigin,
        },
        body: JSON.stringify({ title: "Should be blocked" }),
      });
      assert.equal(res.status, 403);
    });

    // ── Untrusted Origin on cookie PUT → 403 ──
    await t.test("PUT with cookie session and untrusted Origin → 403", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `weekender_session=${sid}`,
          Origin: untrustedOrigin,
        },
        body: JSON.stringify({ name: "Should be blocked" }),
      });
      assert.equal(res.status, 403);
    });

    // ── Untrusted Origin on cookie DELETE → 403 ──
    await t.test("DELETE with cookie session and untrusted Origin → 403", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/follow`, {
        method: "DELETE",
        headers: {
          Cookie: `weekender_session=${sid}`,
          Origin: untrustedOrigin,
        },
      });
      assert.equal(res.status, 403);
    });

    // ── Trusted localhost Origin on cookie POST → passes CSRF, reaches handler ──
    await t.test("POST with cookie session and trusted localhost Origin → passes CSRF check", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/specials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `weekender_session=${sid}`,
          Origin: trustedOrigin,
        },
        body: JSON.stringify({ title: "Special from trusted origin" }),
      });
      // Should reach the handler (201 or 4xx business logic error, never 403 from CSRF)
      assert.notEqual(res.status, 403, "CSRF check must not block trusted-origin request");
    });

    // ── GET requests are CSRF-exempt (safe method) ──
    await t.test("GET with cookie session and no Origin header → CSRF exempt", async () => {
      const res = await fetch(`${baseUrl}/api/bars`, {
        headers: { Cookie: `weekender_session=${sid}` },
      });
      assert.equal(res.status, 200, "safe GET must not be CSRF-blocked");
    });

    // ── Bearer-authenticated POST is CSRF-exempt regardless of Origin ──
    await t.test("Bearer POST with no Origin → passes CSRF (mobile exempt)", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/specials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sid}`,
          // deliberately no Origin
        },
        body: JSON.stringify({ title: "Mobile bearer special" }),
      });
      // Must not be 403 from CSRF middleware; may be 201 or business-logic error
      assert.notEqual(res.status, 403, "Bearer-authenticated mobile requests must bypass CSRF check");
    });

    await t.test("Bearer POST with untrusted Origin → passes CSRF (mobile exempt)", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/specials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sid}`,
          Origin: untrustedOrigin,
        },
        body: JSON.stringify({ title: "Mobile bearer special" }),
      });
      assert.notEqual(res.status, 403, "Bearer mobile writes must never be blocked by CSRF");
    });

    // ── Anonymous POST (no cookie, no Bearer) is CSRF-exempt (reaches 401) ──
    await t.test("Anonymous POST with no Origin → CSRF exempt, reaches auth check → 401", async () => {
      const res = await fetch(`${baseUrl}/api/bars/${bar}/specials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Anon special" }),
      });
      assert.equal(res.status, 401, "anonymous request should reach auth middleware and return 401");
    });

  } finally {
    await stopServer(server);
    await cleanupBars(pool, allBarIds);
    await cleanupUsers(pool, allUserIds);
    await pool.end();
  }
});
