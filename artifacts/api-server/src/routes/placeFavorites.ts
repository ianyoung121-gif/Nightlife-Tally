import { Router } from "express";
import { db, placeFavoritesTable, googleVenueLinksTable, barsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { getPublicPlace, validPlaceId } from "../lib/googlePlaces";
import { requireSignedIn } from "../lib/authorization";

const router = Router();
// The detail route is public and never depends on an owner, claim, or subscription.
router.get("/venues/:providerId", async (req, res) => {
  const id = req.params.providerId;
  if (!validPlaceId(id)) { res.status(400).json({ error: "Invalid venue" }); return; }
  try {
    const [linked] = await db.select({ barId: googleVenueLinksTable.barId }).from(googleVenueLinksTable)
      .innerJoin(barsTable, and(eq(barsTable.id, googleVenueLinksTable.barId), eq(barsTable.ownerId, googleVenueLinksTable.ownerId)))
      .where(and(eq(googleVenueLinksTable.providerId, id), gt(googleVenueLinksTable.expiresAt, new Date())));
    res.json({ ...await getPublicPlace(id), linkedBarId: linked?.barId ?? null });
  }
  catch { res.status(503).json({ error: "Google venue details could not be loaded. Please try again." }); }
});
router.get("/venues/:providerId/notification-preference", async (req, res) => {
  const userId = requireSignedIn(req, res); if (userId === null) return;
  if (!validPlaceId(req.params.providerId)) { res.status(400).json({ error: "Invalid venue." }); return; }
  const [favorite] = await db.select().from(placeFavoritesTable).where(and(eq(placeFavoritesTable.userId, userId), eq(placeFavoritesTable.providerId, req.params.providerId)));
  res.json({ enabled: favorite?.notificationsEnabled ?? false });
});
router.put("/venues/:providerId/notification-preference", async (req, res) => {
  const userId = requireSignedIn(req, res); if (userId === null) return;
  if (!validPlaceId(req.params.providerId) || typeof req.body?.enabled !== "boolean") {
    res.status(400).json({ error: "Choose a valid venue and notification preference." }); return;
  }
  const changed = await db.update(placeFavoritesTable).set({ notificationsEnabled: req.body.enabled })
    .where(and(eq(placeFavoritesTable.userId, userId), eq(placeFavoritesTable.providerId, req.params.providerId))).returning({ id: placeFavoritesTable.id });
  if (!changed.length) { res.status(409).json({ error: "Favorite this Google venue before enabling notifications." }); return; }
  res.json({ enabled: req.body.enabled });
});
router.get("/me/place-favorites", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  const favorites = await db.select({ providerId: placeFavoritesTable.providerId }).from(placeFavoritesTable).where(eq(placeFavoritesTable.userId, userId));
  // Details stay transient. A temporarily unavailable provider must not erase a favorite.
  res.json(favorites);
});
router.get("/venues/:providerId/favorite", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  if (!validPlaceId(req.params.providerId)) { res.status(400).json({ error: "Invalid venue" }); return; }
  const [saved] = await db.select({ id: placeFavoritesTable.id }).from(placeFavoritesTable).where(and(eq(placeFavoritesTable.userId, userId), eq(placeFavoritesTable.providerId, req.params.providerId)));
  res.json({ favorited: Boolean(saved) });
});
router.post("/venues/:providerId/favorite", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  if (!validPlaceId(req.params.providerId)) { res.status(400).json({ error: "Invalid venue" }); return; }
  const existing = await db.select({ providerId: placeFavoritesTable.providerId }).from(placeFavoritesTable).where(eq(placeFavoritesTable.userId, userId));
  if (existing.length >= 100 && !existing.some((f) => f.providerId === req.params.providerId)) {
    res.status(400).json({ error: "You can save up to 100 Google venues." }); return;
  }
  await db.insert(placeFavoritesTable).values({ userId, providerId: req.params.providerId }).onConflictDoNothing();
  res.json({ favorited: true });
});
router.delete("/venues/:providerId/favorite", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  if (!validPlaceId(req.params.providerId)) { res.status(400).json({ error: "Invalid venue" }); return; }
  await db.delete(placeFavoritesTable).where(and(eq(placeFavoritesTable.userId, userId), eq(placeFavoritesTable.providerId, req.params.providerId)));
  res.json({ favorited: false });
});
export default router;
