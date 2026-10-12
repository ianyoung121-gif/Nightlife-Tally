import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, barFollowsTable, barsTable } from "@workspace/db";
import { requireSignedIn } from "../lib/authorization";

const router = Router();

async function followerCount(barId: number): Promise<number> {
  return db.$count(barFollowsTable, eq(barFollowsTable.barId, barId));
}

router.post("/bars/:barId/follow", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  const [bar] = await db.select({ id: barsTable.id }).from(barsTable).where(eq(barsTable.id, barId));
  if (!bar) { res.status(404).json({ error: "Venue not found" }); return; }

  // upsert follow (ignore conflicts)
  const existing = await db
    .select()
    .from(barFollowsTable)
    .where(and(eq(barFollowsTable.barId, barId), eq(barFollowsTable.userId, userId)));

  if (existing.length === 0) {
    await db.insert(barFollowsTable).values({ barId, userId }).onConflictDoNothing();
  }

  res.json({ following: true, followerCount: await followerCount(barId) });
});

router.delete("/bars/:barId/follow", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const userId = requireSignedIn(req, res);
  if (userId === null) return;

  await db
    .delete(barFollowsTable)
    .where(and(eq(barFollowsTable.barId, barId), eq(barFollowsTable.userId, userId)));

  res.json({ following: false, followerCount: await followerCount(barId) });
});

router.get("/bars/:barId/follow/:userId/status", async (req, res): Promise<void> => {
  const rawBarId = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(rawBarId, 10);
  const userId = requireSignedIn(req, res);
  if (isNaN(barId) || userId === null) { if (isNaN(barId)) res.status(400).json({ error: "Invalid params" }); return; }

  const existing = await db
    .select()
    .from(barFollowsTable)
    .where(and(eq(barFollowsTable.barId, barId), eq(barFollowsTable.userId, userId)));

  res.json({ following: existing.length > 0, followerCount: await followerCount(barId) });
});

export default router;
