import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, barFollowsTable, barsTable, drinksTable } from "@workspace/db";
import { requireSignedIn } from "../lib/authorization";
import { barWithStats } from "./bars";

const router = Router();

router.get("/users/:userId", async (req, res): Promise<void> => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.get("/users/:userId/following", async (req, res): Promise<void> => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;

  const follows = await db.select().from(barFollowsTable).where(eq(barFollowsTable.userId, userId));
  if (follows.length === 0) { res.json([]); return; }

  const barIds = follows.map((f) => f.barId);

  // These are venue/community totals, never the account's drinking history.
  const bars = await db.select().from(barsTable);
  const result = await Promise.all(
    bars.filter((b) => barIds.includes(b.id)).map(barWithStats)
  );
  res.json(result);
});

router.get("/users/:userId/activity", async (req, res): Promise<void> => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;

  // Compatibility tombstone for older installed clients. Profiles have favorites,
  // never personal drinking histories; don't even query legacy tally associations.
  res.json([]);
});

export default router;
