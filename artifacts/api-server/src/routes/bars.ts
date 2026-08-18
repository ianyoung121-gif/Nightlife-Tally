import { Router } from "express";
import { eq, like, desc, sql } from "drizzle-orm";
import { db, barsTable, drinksTable, barFollowsTable } from "@workspace/db";

const router = Router();

async function barWithStats(bar: typeof barsTable.$inferSelect) {
  const [{ count: followerCount }] = await db
    .select({ count: db.$count(barFollowsTable, eq(barFollowsTable.barId, bar.id)) })
    .from(barFollowsTable);
  const drinks = await db.select().from(drinksTable).where(eq(drinksTable.barId, bar.id));
  const totalTallies = drinks.reduce((s, d) => s + d.tallyCount, 0);
  return {
    ...bar,
    followerCount: Number(followerCount),
    totalTallies,
    createdAt: bar.createdAt.toISOString(),
  };
}

router.get("/bars", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  let bars;
  if (search) {
    bars = await db.select().from(barsTable).where(like(barsTable.name, `%${search}%`));
  } else {
    bars = await db.select().from(barsTable).orderBy(desc(barsTable.createdAt));
  }
  const result = await Promise.all(bars.map(barWithStats));
  res.json(result);
});

router.post("/bars", async (req, res): Promise<void> => {
  const { name, description, address, coverImageUrl, ownerId, subscriptionActive, latitude, longitude } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [bar] = await db
    .insert(barsTable)
    .values({ name, description, address, coverImageUrl, ownerId, subscriptionActive: subscriptionActive ?? false, latitude, longitude })
    .returning();
  const result = await barWithStats(bar);
  res.status(201).json(result);
});

router.get("/bars/trending", async (req, res): Promise<void> => {
  const bars = await db.select().from(barsTable);
  const withStats = await Promise.all(bars.map(barWithStats));
  const sorted = withStats.sort((a, b) => b.totalTallies - a.totalTallies).slice(0, 10);
  res.json(sorted);
});

router.get("/bars/:barId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const [bar] = await db.select().from(barsTable).where(eq(barsTable.id, barId));
  if (!bar) { res.status(404).json({ error: "Bar not found" }); return; }
  const result = await barWithStats(bar);
  res.json(result);
});

router.put("/bars/:barId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const { name, description, address, coverImageUrl, subscriptionActive, latitude, longitude } = req.body;
  const updates: Partial<typeof barsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (address !== undefined) updates.address = address;
  if (coverImageUrl !== undefined) updates.coverImageUrl = coverImageUrl;
  if (subscriptionActive !== undefined) updates.subscriptionActive = subscriptionActive;
  if (latitude !== undefined) updates.latitude = latitude;
  if (longitude !== undefined) updates.longitude = longitude;

  const [bar] = await db.update(barsTable).set(updates).where(eq(barsTable.id, barId)).returning();
  if (!bar) { res.status(404).json({ error: "Bar not found" }); return; }
  const result = await barWithStats(bar);
  res.json(result);
});

export default router;
