import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, couponsTable, barsTable } from "@workspace/db";
import { requireBarOwner, requireSignedIn, requirePaidBarOwner } from "../lib/authorization";

const router = Router();

function generateCode(barName: string): string {
  const prefix = barName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${suffix}`;
}

function serializeCoupon(c: typeof couponsTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

// Owner view — all coupons for a bar
router.get("/bars/:barId/coupons", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }
  if (!await requireBarOwner(req, res, barId)) return;

  const coupons = await db.select().from(couponsTable).where(eq(couponsTable.barId, barId));
  res.json(coupons.map(serializeCoupon));
});

// Create coupon — requires subscription
router.post("/bars/:barId/coupons", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }
  if (!await requirePaidBarOwner(req, res, barId)) return;

  const [bar] = await db.select().from(barsTable).where(eq(barsTable.id, barId));
  if (!bar) { res.status(404).json({ error: "Bar not found" }); return; }

  const { title, description, discountType, discountValue, expiresAt, maxUses } = req.body;
  if (!title || !discountType) { res.status(400).json({ error: "title and discountType required" }); return; }

  const code = generateCode(bar.name);
  const [coupon] = await db
    .insert(couponsTable)
    .values({ barId, code, title, description, discountType, discountValue, expiresAt, maxUses })
    .returning();

  res.status(201).json(serializeCoupon(coupon));
});

// Patron view — only active, non-expired, not-maxed coupons
router.get("/bars/:barId/coupons/patron", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const coupons = await db
    .select()
    .from(couponsTable)
    .where(and(eq(couponsTable.barId, barId), eq(couponsTable.isActive, true)));

  const now = new Date().toISOString();
  const active = coupons.filter((c) => {
    if (c.expiresAt && c.expiresAt < now) return false;
    if (c.maxUses !== null && c.usedCount >= c.maxUses) return false;
    return true;
  });

  res.json(active.map(serializeCoupon));
});

// Delete coupon
router.delete("/coupons/:couponId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.couponId) ? req.params.couponId[0] : req.params.couponId;
  const couponId = parseInt(raw, 10);
  if (isNaN(couponId)) { res.status(400).json({ error: "Invalid couponId" }); return; }
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.id, couponId));
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  if (!await requireBarOwner(req, res, coupon.barId)) return;
  await db.delete(couponsTable).where(eq(couponsTable.id, couponId));
  res.status(204).send();
});

// Redeem coupon — increments usedCount
router.post("/coupons/:couponId/redeem", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.couponId) ? req.params.couponId[0] : req.params.couponId;
  const couponId = parseInt(raw, 10);
  if (isNaN(couponId)) { res.status(400).json({ error: "Invalid couponId" }); return; }
  if (requireSignedIn(req, res) === null) return;

  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.id, couponId));
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  if (!coupon.isActive) { res.status(410).json({ error: "Coupon is no longer active" }); return; }

  const now = new Date().toISOString();
  if (coupon.expiresAt && coupon.expiresAt < now) {
    res.status(410).json({ error: "Coupon has expired" }); return;
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    res.status(410).json({ error: "Coupon has reached its maximum uses" }); return;
  }

  const [updated] = await db
    .update(couponsTable)
    .set({ usedCount: coupon.usedCount + 1 } as any)
    .where(eq(couponsTable.id, couponId))
    .returning();

  res.json(serializeCoupon(updated));
});

export default router;
