import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const requireFromDbPackage = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDbPackage("pg");

test("deleting an account cascades sessions created concurrently", { timeout: 10_000 }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sessionClient = await pool.connect();
  const deletionClient = await pool.connect();
  const suffix = randomUUID();
  let userId;

  try {
    const [user] = (await pool.query(
      "INSERT INTO users (username, email, oidc_subject) VALUES ($1, $2, $3) RETURNING id",
      [`deletion-test-${suffix}`, `deletion-test-${suffix}@example.invalid`, `deletion-test-${suffix}`],
    )).rows;
    userId = user.id;

    await sessionClient.query("BEGIN");
    await sessionClient.query(
      "INSERT INTO sessions (sid, user_id, sess, expire) VALUES ($1, $2, $3::jsonb, now() + interval '1 hour')",
      [`session-${suffix}`, userId, JSON.stringify({ user: { id: userId } })],
    );

    let deletionFinished = false;
    const deletion = deletionClient
      .query("DELETE FROM users WHERE id = $1", [userId])
      .then(() => { deletionFinished = true; });

    await delay(100);
    assert.equal(deletionFinished, false, "account deletion must wait for an in-flight session insert");

    await sessionClient.query("COMMIT");
    await deletion;

    const remainingSessions = await pool.query("SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1", [userId]);
    assert.equal(remainingSessions.rows[0].count, 0, "cascade deletion must revoke the concurrent session");
  } finally {
    await sessionClient.query("ROLLBACK").catch(() => undefined);
    sessionClient.release();
    deletionClient.release();
    if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.end();
  }
});