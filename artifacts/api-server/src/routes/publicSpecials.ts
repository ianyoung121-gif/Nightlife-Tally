import { Router } from "express";
import { db, publicSpecialsTable, usersTable, barsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod/v4";
import { requireSignedIn } from "../lib/authorization";
import { validPlaceId } from "../lib/googlePlaces";

const router = Router();
async function curator(req: import("express").Request, res: import("express").Response) {
  const id = requireSignedIn(req, res);
  if (id === null) return false;
  const [user] = await db.select({ isCurator: usersTable.isCurator }).from(usersTable).where(eq(usersTable.id, id));
  if (!user?.isCurator) { res.status(403).json({ error: "Public specials are maintained by authorized editors." }); return false; }
  return true;
}

router.get("/me/editor-access", async (req, res) => {
  const id = requireSignedIn(req, res);
  if (id === null) return;
  const [user] = await db.select({ isCurator: usersTable.isCurator }).from(usersTable).where(eq(usersTable.id, id));
  res.json({ canCurate: user?.isCurator ?? false });
});

router.get("/public-specials", async (req, res) => {
  const barId = Number(req.query.barId);
  const providerId = req.query.providerId;
  if (!(Number.isSafeInteger(barId) && barId > 0) && !validPlaceId(providerId)) {
    res.status(400).json({ error: "Choose a venue." }); return;
  }
  const target = Number.isSafeInteger(barId) && barId > 0
    ? eq(publicSpecialsTable.barId, barId)
    : eq(publicSpecialsTable.providerId, providerId as string);
  const specials = await db.select().from(publicSpecialsTable).where(and(target, gt(publicSpecialsTable.expiresAt, new Date())));
  res.json(specials);
});

const checkedSpecial = z.object({
  barId: z.number().int().positive().optional(),
  providerId: z.string().refine(validPlaceId).optional(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(1000),
  sourceUrl: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use the official bar's HTTPS website."),
  expiresAt: z.iso.datetime(),
  confirmedChecked: z.literal(true),
}).refine((data) => Boolean(data.barId) !== Boolean(data.providerId), "Choose exactly one venue.");

router.post("/public-specials", async (req, res) => {
  if (!await curator(req, res)) return;
  const parsed = checkedSpecial.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid special" }); return; }
  const { expiresAt, confirmedChecked, ...values } = parsed.data;
  const expiry = new Date(expiresAt);
  const now = new Date();
  if (expiry <= now || expiry.getTime() - now.getTime() > 30 * 86400000) {
    res.status(400).json({ error: "Public specials must expire within the next 30 days and be rechecked to stay current." }); return;
  }
  if (values.barId) {
    const [bar] = await db.select({ id: barsTable.id }).from(barsTable).where(eq(barsTable.id, values.barId));
    if (!bar) { res.status(404).json({ error: "Venue not found" }); return; }
  }
  const [special] = await db.insert(publicSpecialsTable).values({ ...values, checkedAt: now, expiresAt: expiry }).returning();
  res.status(201).json(special);
});

router.delete("/public-specials/:specialId", async (req, res) => {
  if (!await curator(req, res)) return;
  const id = Number(req.params.specialId);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid special" }); return; }
  const removed = await db.delete(publicSpecialsTable).where(eq(publicSpecialsTable.id, id)).returning({ id: publicSpecialsTable.id });
  if (!removed.length) { res.status(404).json({ error: "Special not found" }); return; }
  res.status(204).end();
});
export default router;
