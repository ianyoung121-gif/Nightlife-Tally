import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, barsTable, drinksTable, barFollowsTable } from "@workspace/db";

const router = Router();

router.get("/bars/:barId/stats", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const [{ count: followerCount }] = await db
    .select({ count: db.$count(barFollowsTable, eq(barFollowsTable.barId, barId)) })
    .from(barFollowsTable);

  const drinks = await db
    .select()
    .from(drinksTable)
    .where(eq(drinksTable.barId, barId))
    .orderBy(desc(drinksTable.tallyCount));

  const totalTallies = drinks.reduce((s, d) => s + d.tallyCount, 0);

  const [bar] = await db.select({ name: barsTable.name }).from(barsTable).where(eq(barsTable.id, barId));

  const topDrinks = drinks.slice(0, 5).map((d) => ({
    ...d,
    barName: bar?.name ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  // weekly tallies (all for now — could filter by date)
  res.json({
    barId,
    followerCount: Number(followerCount),
    totalTallies,
    topDrinks,
    weeklyTallies: totalTallies,
  });
});

router.get("/stats/trending", async (req, res): Promise<void> => {
  const allBars = await db.select().from(barsTable);
  const allDrinks = await db.select().from(drinksTable).orderBy(desc(drinksTable.tallyCount)).limit(10);

  const topDrinks = await Promise.all(
    allDrinks.map(async (d) => {
      const [bar] = await db.select({ name: barsTable.name }).from(barsTable).where(eq(barsTable.id, d.barId));
      return { ...d, barName: bar?.name ?? null, createdAt: d.createdAt.toISOString() };
    })
  );

  const barsWithStats = await Promise.all(
    allBars.map(async (bar) => {
      const [{ count: followerCount }] = await db
        .select({ count: db.$count(barFollowsTable, eq(barFollowsTable.barId, bar.id)) })
        .from(barFollowsTable);
      const drinks = await db.select().from(drinksTable).where(eq(drinksTable.barId, bar.id));
      const totalTallies = drinks.reduce((s, d) => s + d.tallyCount, 0);
      return { ...bar, followerCount: Number(followerCount), totalTallies, createdAt: bar.createdAt.toISOString() };
    })
  );

  const topBars = barsWithStats.sort((a, b) => b.totalTallies - a.totalTallies).slice(0, 5);
  const totalTallies = barsWithStats.reduce((s, b) => s + b.totalTallies, 0);

  res.json({
    totalTallies,
    totalBars: allBars.length,
    topDrinks,
    topBars,
  });
});

export default router;
