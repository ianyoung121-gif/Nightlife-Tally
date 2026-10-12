import { Router } from "express";
import { eq, like, desc } from "drizzle-orm";
import { db, barsTable, drinksTable, barFollowsTable } from "@workspace/db";
import { requireBarOwner, requireSignedIn } from "../lib/authorization";
import { getMembership } from "../lib/membership";

const router = Router();

type VerifiedLocation = {
  latitude: number;
  longitude: number;
};

function parseLocation(body: unknown): { location?: VerifiedLocation; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be an object." };
  }

  const data = body as Record<string, unknown>;
  const hasLatitude = Object.hasOwn(data, "latitude");
  const hasLongitude = Object.hasOwn(data, "longitude");

  if (!hasLatitude && !hasLongitude) {
    return {};
  }

  if (!hasLatitude || !hasLongitude) {
    return { error: "latitude and longitude must be provided together." };
  }

  const { latitude, longitude } = data;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { error: "latitude must be between -90 and 90 and longitude must be between -180 and 180." };
  }

  return { location: { latitude, longitude } };
}

export async function barWithStats(bar: typeof barsTable.$inferSelect) {
  const followerCount = await db.$count(barFollowsTable, eq(barFollowsTable.barId, bar.id));
  const drinks = await db.select().from(drinksTable).where(eq(drinksTable.barId, bar.id));
  const totalTallies = drinks.reduce((s, d) => s + d.tallyCount, 0);
  // Badges are displayed only for a verified entitlement. Public venue info
  // remains available even during billing outages; paid writes fail closed.
  let subscriptionActive = false;
  if (bar.ownerId) {
    try { subscriptionActive = (await getMembership(bar.id, bar.ownerId)).active; } catch {}
  }
  return {
    ...bar,
    subscriptionActive,
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

router.get("/bars/mine", async (req, res): Promise<void> => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  const bars = await db.select().from(barsTable).where(eq(barsTable.ownerId, userId)).orderBy(desc(barsTable.createdAt));
  res.json(await Promise.all(bars.map(barWithStats)));
});

router.post("/bars", async (req, res): Promise<void> => {
  const ownerId = requireSignedIn(req, res);
  if (ownerId === null) return;
  const { name, description, address, coverImageUrl } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const { location, error } = parseLocation(req.body);
  if (error) { res.status(400).json({ error }); return; }
  const [bar] = await db
    .insert(barsTable)
    .values({
      name,
      description,
      address,
      coverImageUrl,
      ownerId,
      subscriptionActive: false,
      ...location,
      locationVerifiedAt: location ? new Date() : null,
    })
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
  if (!await requireBarOwner(req, res, barId)) return;

  const { name, description, address, coverImageUrl } = req.body;
  const { location, error } = parseLocation(req.body);
  if (error) { res.status(400).json({ error }); return; }

  const updates: Partial<typeof barsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (address !== undefined) updates.address = address;
  if (coverImageUrl !== undefined) updates.coverImageUrl = coverImageUrl;
  if (location) {
    updates.latitude = location.latitude;
    updates.longitude = location.longitude;
    updates.locationVerifiedAt = new Date();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No changes supplied." });
    return;
  }

  const [bar] = await db.update(barsTable).set(updates).where(eq(barsTable.id, barId)).returning();
  if (!bar) { res.status(404).json({ error: "Bar not found" }); return; }
  const result = await barWithStats(bar);
  res.json(result);
});

export default router;
