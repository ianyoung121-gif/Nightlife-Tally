import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, drinksTable, talliesTable, barsTable } from "@workspace/db";

const router = Router();

async function drinkWithBarName(drink: typeof drinksTable.$inferSelect) {
  const [bar] = await db.select({ name: barsTable.name }).from(barsTable).where(eq(barsTable.id, drink.barId));
  return {
    ...drink,
    barName: bar?.name ?? null,
    createdAt: drink.createdAt.toISOString(),
  };
}

router.get("/bars/:barId/drinks", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const drinks = await db
    .select()
    .from(drinksTable)
    .where(eq(drinksTable.barId, barId))
    .orderBy(desc(drinksTable.tallyCount));
  const result = await Promise.all(drinks.map(drinkWithBarName));
  res.json(result);
});

router.post("/bars/:barId/drinks", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const { name, category, description, price } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }

  const [drink] = await db
    .insert(drinksTable)
    .values({ barId, name, category, description, price })
    .returning();
  const result = await drinkWithBarName(drink);
  res.status(201).json(result);
});

router.post("/drinks/:drinkId/tally", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.drinkId) ? req.params.drinkId[0] : req.params.drinkId;
  const drinkId = parseInt(raw, 10);
  if (isNaN(drinkId)) { res.status(400).json({ error: "Invalid drinkId" }); return; }

  // increment tally count — no user ID stored, tallies are anonymous by design
  const [drink] = await db
    .update(drinksTable)
    .set({ tallyCount: sql<number>`${drinksTable.tallyCount} + 1` })
    .where(eq(drinksTable.id, drinkId))
    .returning();
  if (!drink) { res.status(404).json({ error: "Drink not found" }); return; }

  // record only the drink + timestamp, never the user — preserves patron privacy
  await db.insert(talliesTable).values({ drinkId, userId: null });

  const result = await drinkWithBarName(drink);
  res.json(result);
});

router.get("/drinks/trending", async (req, res): Promise<void> => {
  const drinks = await db
    .select()
    .from(drinksTable)
    .orderBy(desc(drinksTable.tallyCount))
    .limit(20);
  const result = await Promise.all(drinks.map(drinkWithBarName));
  res.json(result);
});

export default router;
