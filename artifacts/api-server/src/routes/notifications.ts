import { Router } from "express";
import { db, barFollowsTable, pushDevicesTable, promotionMessagesTable, barsTable } from "@workspace/db";
import { and, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireSignedIn, requirePaidBarOwner } from "../lib/authorization";

const router = Router();
const deviceSchema = z.object({ token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/) });

router.post("/me/push-device", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  const data = deviceSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid notification device." }); return; }
  // A device changing accounts is assigned to its current authenticated account.
  await db.insert(pushDevicesTable).values({ userId, token: data.data.token }).onConflictDoUpdate({ target: pushDevicesTable.token, set: { userId } });
  res.json({ enabled: true });
});
router.delete("/me/push-device", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  const data = deviceSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid notification device." }); return; }
  await db.delete(pushDevicesTable).where(and(eq(pushDevicesTable.userId, userId), eq(pushDevicesTable.token, data.data.token)));
  res.status(204).end();
});
router.get("/bars/:barId/notification-preference", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  if (!Number.isSafeInteger(Number(req.params.barId)) || Number(req.params.barId) < 1) { res.status(400).json({ error: "Invalid venue." }); return; }
  const [follow] = await db.select({ enabled: barFollowsTable.notificationsEnabled }).from(barFollowsTable).where(and(eq(barFollowsTable.userId, userId), eq(barFollowsTable.barId, Number(req.params.barId))));
  res.json({ enabled: follow?.enabled ?? false });
});
router.put("/bars/:barId/notification-preference", async (req, res) => {
  const userId = requireSignedIn(req, res);
  if (userId === null) return;
  if (!Number.isSafeInteger(Number(req.params.barId)) || Number(req.params.barId) < 1) { res.status(400).json({ error: "Invalid venue." }); return; }
  if (typeof req.body.enabled !== "boolean") { res.status(400).json({ error: "Choose whether notifications are enabled." }); return; }
  const changed = await db.update(barFollowsTable).set({ notificationsEnabled: req.body.enabled }).where(and(eq(barFollowsTable.userId, userId), eq(barFollowsTable.barId, Number(req.params.barId)))).returning({ id: barFollowsTable.id });
  if (!changed.length) { res.status(409).json({ error: "Favorite this venue before enabling its notifications." }); return; }
  res.json({ enabled: req.body.enabled });
});

const messageSchema = z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(240) });
router.post("/bars/:barId/notifications", async (req, res) => {
  const barId = Number(req.params.barId);
  if (!Number.isSafeInteger(barId) || barId < 1) { res.status(400).json({ error: "Invalid venue." }); return; }
  if (!await requirePaidBarOwner(req, res, barId)) return;
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Title must be 1–80 characters and message 1–240." }); return; }
  // Serialize broadcasts per bar; clicking Send twice cannot bypass the daily limit.
  const outcome = await db.transaction(async (tx) => {
    const [bar] = await tx.select().from(barsTable).where(eq(barsTable.id, barId)).for("update");
    const recent = await tx.select({ id: promotionMessagesTable.id }).from(promotionMessagesTable).where(and(eq(promotionMessagesTable.barId, barId), gt(promotionMessagesTable.createdAt, new Date(Date.now() - 86400000))));
    if (recent.length) return { limited: true as const };
    const recipients = await tx.selectDistinct({ token: pushDevicesTable.token }).from(pushDevicesTable)
      .innerJoin(barFollowsTable, eq(pushDevicesTable.userId, barFollowsTable.userId))
      .where(and(eq(barFollowsTable.barId, barId), eq(barFollowsTable.notificationsEnabled, true)));
    if (!recipients.length) return { empty: true as const };
    const [message] = await tx.insert(promotionMessagesTable).values({ barId, ...parsed.data }).returning();
    return { message, recipients, barName: bar.name };
  });
  if ("limited" in outcome) { res.status(429).json({ error: "One follower notification per venue per 24 hours." }); return; }
  if ("empty" in outcome) { res.json({ accepted: 0, failed: 0, message: "No followers have opted in on a notification-enabled device yet." }); return; }
  let accepted = 0, failed = 0;
  try {
    for (let offset = 0; offset < outcome.recipients.length; offset += 100) {
      const group = outcome.recipients.slice(offset, offset + 100);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(group.map(({ token }) => ({
          to: token, title: `${outcome.barName}: ${parsed.data.title}`, body: parsed.data.body,
          sound: "default", channelId: "venue-specials", data: { barId },
        }))), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Push service unavailable");
      const result = await response.json() as { data?: Array<{ status: string; details?: { error?: string } }> };
      if (!Array.isArray(result.data) || result.data.length !== group.length) throw new Error("Invalid push response");
      const invalid: string[] = [];
      result.data.forEach((ticket, index) => {
        if (ticket.status === "ok") accepted++; else failed++;
        if (ticket.details?.error === "DeviceNotRegistered") invalid.push(group[index].token);
      });
      if (invalid.length) await db.delete(pushDevicesTable).where(inArray(pushDevicesTable.token, invalid));
    }
    await db.update(promotionMessagesTable).set({ sent: accepted > 0 }).where(eq(promotionMessagesTable.id, outcome.message.id));
    res.json({ accepted, failed, message: "Accepted by the notification service. Delivery depends on device permissions." });
  } catch {
    // Keep the reservation: ambiguous transport failures must not cause duplicate broadcasts.
    res.status(503).json({ error: "Notification delivery could not be confirmed. The send is reserved to prevent duplicate alerts." });
  }
});
export default router;
