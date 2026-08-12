import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, barFollowsTable, barsTable, talliesTable, drinksTable } from "@workspace/db";

const router = Router();

router.post("/users", async (req, res): Promise<void> => {
  const { username, email, avatarUrl } = req.body;
  if (!username || !email) {
    res.status(400).json({ error: "username and email required" });
    return;
  }
  const [user] = await db.insert(usersTable).values({ username, email, avatarUrl }).returning();
  res.status(201).json(user);
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.get("/users/:userId/following", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const follows = await db.select().from(barFollowsTable).where(eq(barFollowsTable.userId, userId));
  if (follows.length === 0) { res.json([]); return; }

  const barIds = follows.map((f) => f.barId);

  // get bars with follower counts and total tallies
  const bars = await db.select().from(barsTable);
  const result = await Promise.all(
    bars.filter((b) => barIds.includes(b.id)).map(async (bar) => {
      const [{ count: followerCount }] = await db
        .select({ count: db.$count(barFollowsTable, eq(barFollowsTable.barId, bar.id)) })
        .from(barFollowsTable);
      const drinks = await db.select().from(drinksTable).where(eq(drinksTable.barId, bar.id));
      const totalTallies = drinks.reduce((s, d) => s + d.tallyCount, 0);
      return { ...bar, followerCount: Number(followerCount), totalTallies };
    })
  );
  res.json(result);
});

router.get("/users/:userId/activity", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const tallies = await db
    .select()
    .from(talliesTable)
    .where(eq(talliesTable.userId, userId))
    .orderBy(talliesTable.createdAt)
    .limit(50);

  const activity = await Promise.all(
    tallies.map(async (t) => {
      const [drink] = await db.select().from(drinksTable).where(eq(drinksTable.id, t.drinkId));
      if (!drink) return null;
      const [bar] = await db.select().from(barsTable).where(eq(barsTable.id, drink.barId));
      if (!bar) return null;
      return {
        drinkId: drink.id,
        drinkName: drink.name,
        barId: bar.id,
        barName: bar.name,
        createdAt: t.createdAt.toISOString(),
      };
    })
  );
  res.json(activity.filter(Boolean).reverse());
});

export default router;
