import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const requireFromDbPackage = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDbPackage("pg");

const TALLY_REQUESTS = 20;
const artifactDirectory = fileURLToPath(new URL("..", import.meta.url));

async function createDrinkFixture(pool) {
  const [drink] = (await pool.query(
    "INSERT INTO drinks (bar_id, name, category) VALUES ($1, $2, $3) RETURNING id",
    [0, `Concurrent tally test ${Date.now()}`, "Test"],
  )).rows;
  return drink;
}

async function waitForServer(baseUrl, server, stderr, getSpawnError) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error(`API server could not start: ${spawnError.message}`);
    }

    if (server.exitCode !== null) {
      throw new Error(`API server exited before becoming ready:\n${stderr.join("")}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
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
  if (server.kill("SIGKILL")) {
    await Promise.race([forceExited, delay(1_000)]);
  }
}

test("concurrent drink tallies retain every successful increment", { timeout: 20_000 }, async () => {
  const port = randomInt(30_000, 40_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const stderr = [];
  let spawnError;
  const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: artifactDirectory,
    env: { ...process.env, NODE_ENV: "test", PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  server.on("error", (error) => { spawnError = error; });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let drinkId;

  try {
    await waitForServer(baseUrl, server, stderr, () => spawnError);
    const drink = await createDrinkFixture(pool);
    drinkId = drink.id;

    const tallyResponses = await Promise.all(
      Array.from({ length: TALLY_REQUESTS }, () =>
        fetch(`${baseUrl}/api/drinks/${drinkId}/tally`, { method: "POST" }),
      ),
    );
    const successfulTallies = tallyResponses.filter((response) => response.ok);
    assert.equal(successfulTallies.length, TALLY_REQUESTS);

    const drinksResponse = await fetch(`${baseUrl}/api/bars/0/drinks`);
    assert.equal(drinksResponse.status, 200);

    const drinks = await drinksResponse.json();
    const finalDrink = drinks.find((candidate) => candidate.id === drinkId);
    assert.ok(finalDrink, "created drink should still be listed");
    assert.equal(finalDrink.tallyCount, successfulTallies.length);
  } finally {
    await stopServer(server);

    if (drinkId) {
      const deletedTallies = await pool.query("DELETE FROM tallies WHERE drink_id = $1", [drinkId]);
      const deletedDrink = await pool.query("DELETE FROM drinks WHERE id = $1", [drinkId]);
      assert.equal(deletedTallies.rowCount, TALLY_REQUESTS);
      assert.equal(deletedDrink.rowCount, 1);
    }

    await pool.end();
  }
});