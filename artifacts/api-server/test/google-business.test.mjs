import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomInt, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const requireApi = createRequire(new URL("../package.json", import.meta.url));
const { build } = requireApi("esbuild");
const requireDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireDb("pg");
const compiled = await build({ entryPoints: [fileURLToPath(new URL("../src/lib/googleBusinessClient.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false });
const client = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const key = "unit-test-encryption-key-not-a-real-secret";
const location = { name: "locations/123", title: "Test venue", storefrontAddress: { regionCode: "US", addressLines: ["1 Test St"] }, metadata: { placeId: "ChIJtestPlace12345" } };
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("OAuth temporary material is authenticated, encrypted and randomized", () => {
  const a = client.sealGooglePayload({ token: "not-a-real-token" }, key);
  const b = client.sealGooglePayload({ token: "not-a-real-token" }, key);
  assert.notEqual(a, b);
  assert.ok(!a.includes("not-a-real-token"));
  assert.deepEqual(client.openGooglePayload(a, key), { token: "not-a-real-token" });
  assert.throws(() => client.openGooglePayload(a, key + "wrong"));
  assert.throws(() => client.openGooglePayload(a.slice(0, -8) + "BADTHING", key));
  assert.throws(() => client.sealGooglePayload({}, "short"));
});
test("owner OAuth uses PKCE and does not request persistent refresh tokens or user email", () => {
  const url = new URL(client.googleConsentUrl("test-id", "https://example.test/api/google-business/callback", "test-state", "test-verifier"));
  assert.equal(url.hostname, "accounts.google.com");
  assert.equal(url.searchParams.get("state"), "test-state");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.notEqual(url.searchParams.get("code_challenge"), "test-verifier");
  assert.equal(url.searchParams.get("access_type"), "online");
  assert.equal(url.searchParams.get("scope"), client.BUSINESS_SCOPE);
});
test("server checks authorized location and BOTH Google authority flags", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push(url); assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.method ?? "GET", "GET");
    return response(url.includes("getVoiceOfMerchantState") ? { hasVoiceOfMerchant: true, hasBusinessAuthority: true } : location);
  };
  assert.equal((await client.verifyGoogleLocation("test-token", "locations/123", fetcher)).providerId, location.metadata.placeId);
  assert.equal(calls.length, 2);
  for (const flags of [{}, { hasVoiceOfMerchant: true }, { hasBusinessAuthority: true }, { hasVoiceOfMerchant: "true", hasBusinessAuthority: true }]) {
    await assert.rejects(client.verifyGoogleLocation("test-token", "locations/123", async url => response(url.includes("getVoiceOfMerchantState") ? flags : location)));
  }
});
test("forged resources, mismatched locations and non-US or ID-less listings fail closed", async () => {
  let called = false;
  await assert.rejects(client.verifyGoogleLocation("test-token", "https://evil.example", async () => { called = true; return response(location); }));
  assert.equal(called, false);
  for (const bad of [{ ...location, name: "locations/999" }, { ...location, storefrontAddress: { regionCode: "CA" } }, { ...location, metadata: {} }]) {
    await assert.rejects(client.verifyGoogleLocation("test-token", "locations/123", async () => response(bad)));
  }
});
test("Google token exchange requires the actual granted business permission", async () => {
  const config = { clientId: "test-id", clientSecret: "test-secret", redirectUri: "https://example.test/api/google-business/callback" };
  await assert.rejects(client.exchangeGoogleCode("test-code", "test-verifier", config, async () => response({ access_token: "test-token", token_type: "Bearer", scope: "openid" })));
  const result = await client.exchangeGoogleCode("test-code", "test-verifier", config, async (_url, init) => {
    assert.equal(init.body.get("code_verifier"), "test-verifier");
    assert.equal(init.body.get("redirect_uri"), config.redirectUri);
    return response({ access_token: "test-token", token_type: "Bearer", scope: client.BUSINESS_SCOPE, expires_in: 3600 });
  });
  assert.equal(result.expiresIn, 600);
});
test("managed venue discovery follows account and location pagination without using client-supplied URLs", async () => {
  let pages = 0;
  const list = await client.listGoogleLocations("test-token", async url => {
    if (url.includes("accountmanagement")) return response({ accounts: [{ name: "accounts/7" }, { name: "https://evil.example" }] });
    const parsed = new URL(url); assert.equal(parsed.hostname, "mybusinessbusinessinformation.googleapis.com");
    assert.equal(parsed.searchParams.get("readMask"), "name,title,storefrontAddress,metadata");
    pages++;
    return response(pages === 1 ? { locations: [location], nextPageToken: "next page" } : { locations: [location, { ...location, name: "locations/8", storefrontAddress: { regionCode: "CA" } }] });
  });
  assert.equal(pages, 2);
  assert.equal(list.length, 1);
});

test("real API rejects outsiders, forged callbacks and replay; Google-favorite alerts require explicit saved-favorite consent", async t => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const port = randomInt(22000, 29000);
  const base = `http://127.0.0.1:${port}`;
  const fixture = randomUUID().replaceAll("-", "");
  const userIds = [], barIds = [], sessionIds = [];
  let server;
  try {
    for (let i = 0; i < 2; i++) {
      const user = (await pool.query("INSERT INTO users(username,email) VALUES($1,$2) RETURNING id", [`google-test-${fixture}-${i}`, `google-${fixture}-${i}@example.invalid`])).rows[0];
      userIds.push(user.id);
      const sid = `google-test-session-${fixture}-${i}`; sessionIds.push(sid);
      await pool.query("INSERT INTO sessions(sid,user_id,sess,expire) VALUES($1,$2,$3,now()+interval '1 hour')",
        [sid, user.id, JSON.stringify({ user: { id: user.id, username: `google-test-${fixture}-${i}`, email: `google-${fixture}-${i}@example.invalid` } })]);
    }
    barIds.push((await pool.query("INSERT INTO bars(name,owner_id) VALUES($1,$2) RETURNING id", [`Google test ${fixture}`, userIds[0]])).rows[0].id);
    const stderr = [];
    server = spawn(process.execPath, ["./dist/index.mjs"], { cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, NODE_ENV: "test", PORT: String(port), CLERK_SECRET_KEY: "",
        SESSION_SECRET: key, GOOGLE_BUSINESS_CLIENT_ID: "test-id", GOOGLE_BUSINESS_CLIENT_SECRET: "test-secret",
        GOOGLE_BUSINESS_REDIRECT_URI: "https://example.test/api/google-business/callback" },
      stdio: ["ignore", "ignore", "pipe"] });
    server.on("error", error => stderr.push(error.name)); server.stderr.on("data", data => stderr.push(data.toString()));
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error("Test API failed to start");
      try { if ((await fetch(`${base}/api/healthz`)).ok) { ready = true; break; } } catch {}
      await delay(50);
    }
    assert.ok(ready, "Test API started");
    const request = (path, options = {}, actor = 0, cookies = "") => fetch(`${base}/api${path}`, {
      ...options, redirect: "manual", headers: { "Content-Type": "application/json",
        ...(actor === null ? {} : { Authorization: `Bearer ${sessionIds[actor]}` }), ...(cookies ? { Cookie: cookies } : {}), ...options.headers },
    });
    await t.test("only the owning signed-in account can start or inspect Google connection", async () => {
      assert.equal((await request(`/bars/${barIds[0]}/google-business`, {}, null)).status, 401);
      assert.equal((await request(`/bars/${barIds[0]}/google-business`, {}, 1)).status, 403);
      assert.equal((await request(`/bars/${barIds[0]}/google-business/connect`, { method: "POST" }, 1)).status, 403);
      assert.equal((await request(`/bars/${barIds[0]}/google-business/connect`, { method: "POST", headers: { Origin: base } })).status, 503);
    });
    await t.test("state is hashed/encrypted and callback is browser-bound and single-use", async () => {
      const start = await request(`/bars/${barIds[0]}/google-business/connect`, { method: "POST" });
      assert.equal(start.status, 200);
      const consent = new URL((await start.json()).url), state = consent.searchParams.get("state");
      const browserCookie = start.headers.getSetCookie().find(v => v.startsWith("weekender_google_browser=")).split(";")[0];
      const stored = (await pool.query("SELECT * FROM google_business_sessions WHERE user_id=$1", [userIds[0]])).rows[0];
      assert.notEqual(stored.hash, state);
      assert.ok(!stored.encrypted_payload.includes("verifier"));
      const path = `/google-business/callback?state=${state}&error=access_denied`;
      assert.equal((await request(path, {}, null)).status, 400);
      assert.equal((await request(path, {}, 1, browserCookie)).status, 403);
      assert.equal((await request(path, {}, 0, browserCookie)).status, 400, "mismatched actor consumed callback without granting access");
      const second = await request(`/bars/${barIds[0]}/google-business/connect`, { method: "POST" });
      const secondState = new URL((await second.json()).url).searchParams.get("state");
      const secondCookie = second.headers.getSetCookie().find(v => v.startsWith("weekender_google_browser=")).split(";")[0];
      const denied = `/google-business/callback?state=${secondState}&error=access_denied`;
      const done = await request(denied, {}, null, secondCookie);
      assert.equal(done.status, 302);
      assert.equal(done.headers.get("location"), "https://example.test/dashboard?googleBusiness=denied");
      assert.equal((await request(denied, {}, null, secondCookie)).status, 400);
    });
    await t.test("Google favorite notification opt-in does not follow merely from favoriting", async () => {
      const pref = `/venues/${location.metadata.placeId}/notification-preference`;
      assert.equal((await request(pref, { method: "PUT", body: JSON.stringify({ enabled: true }) })).status, 409);
      await request(`/venues/${location.metadata.placeId}/favorite`, { method: "POST" });
      assert.equal((await (await request(pref)).json()).enabled, false);
      assert.equal((await request(pref, { method: "PUT", body: JSON.stringify({ enabled: true }) })).status, 200);
      assert.equal((await (await request(pref)).json()).enabled, true);
      assert.equal((await (await request(pref, {}, 1)).json()).enabled, false);
      await request(`/venues/${location.metadata.placeId}/favorite`, { method: "DELETE" });
      assert.equal((await (await request(pref)).json()).enabled, false);
    });
    await t.test("real expired Google proof blocks publishing, and a changed owner cannot inherit old verification", async () => {
      await pool.query("INSERT INTO google_venue_links(bar_id,owner_id,provider_id,verified_at,expires_at) VALUES($1,$2,$3,now(),now()-interval '1 minute')", [barIds[0], userIds[0], location.metadata.placeId]);
      assert.equal((await (await request(`/bars/${barIds[0]}/google-business`)).json()).needsReverification, true);
      const blocked = await request(`/bars/${barIds[0]}/specials`, { method: "POST", body: JSON.stringify({ title: "Expired owner proof must not publish" }) });
      assert.equal(blocked.status, 403);
      assert.match((await blocked.json()).error, /Reconnect Google/);
      await pool.query("UPDATE google_venue_links SET expires_at=now()+interval '30 days' WHERE bar_id=$1", [barIds[0]]);
      await pool.query("UPDATE bars SET owner_id=$1 WHERE id=$2", [userIds[1], barIds[0]]);
      assert.equal((await (await request(`/bars/${barIds[0]}/google-business`, {}, 1)).json()).needsReverification, true);
      assert.equal((await request(`/bars/${barIds[0]}/google-business`, { method: "DELETE" }, 1)).status, 204);
      assert.equal(Number((await pool.query("SELECT count(*) FROM google_venue_links WHERE bar_id=$1", [barIds[0]])).rows[0].count), 0);
      await pool.query("UPDATE bars SET owner_id=$1 WHERE id=$2", [userIds[0], barIds[0]]);
    });
    await t.test("disconnect preserves favorites and deleting an account cascades temporary Google credentials", async () => {
      await pool.query("INSERT INTO google_venue_links(bar_id,owner_id,provider_id,verified_at,expires_at) VALUES($1,$2,$3,now(),now()+interval '30 days')", [barIds[0], userIds[0], location.metadata.placeId]);
      await request(`/venues/${location.metadata.placeId}/favorite`, { method: "POST" });
      assert.equal((await request(`/bars/${barIds[0]}/google-business`, { method: "DELETE" }, 1)).status, 403);
      assert.equal((await request(`/bars/${barIds[0]}/google-business`, { method: "DELETE" })).status, 204);
      assert.equal((await (await request(`/venues/${location.metadata.placeId}/favorite`)).json()).favorited, true);
      await request(`/bars/${barIds[0]}/google-business/connect`, { method: "POST" });
      await pool.query("DELETE FROM users WHERE id=$1", [userIds[0]]);
      assert.equal(Number((await pool.query("SELECT count(*) FROM google_business_sessions WHERE user_id=$1", [userIds[0]])).rows[0].count), 0);
    });
  } finally {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      for (let i = 0; i < 20 && server.exitCode === null; i++) await delay(50);
      if (server.exitCode === null) server.kill("SIGKILL");
    }
    await pool.query("DELETE FROM bars WHERE id=ANY($1::int[])", [barIds]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [userIds]);
    await pool.end();
  }
});
