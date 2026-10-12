import { Router } from "express";
import { db, pool, barsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireBarOwner } from "../lib/authorization";
import { getMembership, isOwnerSubscription } from "../lib/membership";
import { getUncachableStripeClient, getStripeSync } from "../stripeClient";

const router = Router();
function returnUrl(req: import("express").Request) {
  // Only a deployment-controlled origin and a fixed dashboard path may redirect checkout.
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const publicUrl = process.env.WEEKENDER_PUBLIC_URL;
  if (!publicUrl && (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1")) {
    throw new Error("Published app URL is required for checkout");
  }
  const url = new URL(publicUrl ?? (domain ? `https://${domain}` : ""));
  if (url.protocol !== "https:") throw new Error("Checkout domain is unavailable");
  return `${url.origin}/dashboard`;
}

router.get("/bars/:barId/membership", async (req, res) => {
  const barId = Number(req.params.barId);
  if (!Number.isSafeInteger(barId) || barId < 1) { res.status(400).json({ error: "Invalid bar" }); return; }
  if (!await requireBarOwner(req, res, barId)) return;
  const user = req.user;
  if (!user) { res.status(401).json({ error: "Sign in is required" }); return; }
  try {
    // Returning from checkout does not itself enable access. A session is verified
    // with Stripe and synced before reading the actual subscription entitlement.
    if (typeof req.query.checkoutSessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(req.query.checkoutSessionId)) {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(req.query.checkoutSessionId);
      if (session.metadata?.weekenderUserId !== String(user.id) || session.metadata?.weekenderBarId !== String(barId)) {
        res.status(403).json({ error: "Checkout belongs to a different venue or account" }); return;
      }
      if (session.subscription && session.status === "complete") {
        const sync = await getStripeSync();
        await sync.syncSingleEntity(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
      }
    }
    const membership = await getMembership(barId, user.id);
    res.json({ active: membership.active, monthlyPrice: 5, currency: "USD", cancelAtPeriodEnd: membership.subscription?.cancel_at_period_end ?? false });
  } catch { res.status(503).json({ error: "Billing is unavailable. Please try again shortly." }); }
});

router.post("/bars/:barId/checkout", async (req, res) => {
  const barId = Number(req.params.barId);
  if (!Number.isSafeInteger(barId) || barId < 1) { res.status(400).json({ error: "Invalid bar" }); return; }
  if (!await requireBarOwner(req, res, barId)) return;
  const user = req.user;
  if (!user) { res.status(401).json({ error: "Sign in is required" }); return; }
  try {
    const stripe = await getUncachableStripeClient();
    const prices = await pool.query("SELECT id FROM stripe.prices WHERE _raw_data->>'lookup_key' = 'weekender_owner_monthly' AND (_raw_data->>'active')::boolean = true AND (_raw_data->>'unit_amount')::integer = 500 AND _raw_data->>'currency' = 'usd' LIMIT 1");
    const priceId = prices.rows[0]?.id;
    if (!priceId) { res.status(503).json({ error: "The owner plan is not configured yet." }); return; }
    const outcome = await db.transaction(async (tx) => {
      const [account] = await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, user.id)).for("update");
      if (!account) throw new Error("Account no longer exists");
      // Serialize requests for a venue, including two tabs spanning an idempotency bucket.
      await tx.select({ id: barsTable.id }).from(barsTable).where(eq(barsTable.id, barId)).for("update");
      if ((await getMembership(barId, user.id)).active) return { active: true as const };
      const existing = await pool.query("SELECT id FROM stripe.customers WHERE _raw_data->'metadata'->>'weekenderUserId' = $1 AND COALESCE((_raw_data->>'deleted')::boolean, false) = false LIMIT 1", [String(user.id)]);
      const customer = existing.rows[0]?.id ?? (await stripe.customers.create({
        email: user.email, metadata: { weekenderUserId: String(user.id) },
      }, { idempotencyKey: `weekender-user-${user.id}` })).id;
      const sync = await getStripeSync();
      await sync.syncSingleEntity(customer);
      // Check Stripe too: an already-paid session cannot create a second plan
      // while its webhook is still in transit.
      const subscriptions = await stripe.subscriptions.list({ customer, status: "active", limit: 100 });
      const active = subscriptions.data.find((s) => isOwnerSubscription(s, barId, user.id));
      if (active) { await sync.syncSingleEntity(active.id); return { active: true as const }; }
      const sessions = await stripe.checkout.sessions.list({ customer, limit: 100 });
      const pending = sessions.data.find((s) => s.status === "open"
        && s.metadata?.weekenderBarId === String(barId) && s.metadata?.weekenderUserId === String(user.id));
      if (pending?.url) return { url: pending.url };
      const metadata = { weekenderBarId: String(barId), weekenderUserId: String(user.id) };
      const base = returnUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription", customer,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: String(user.id),
        metadata, subscription_data: { metadata },
        success_url: `${base}?checkoutSessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}?checkout=cancelled`,
      }, { idempotencyKey: `venue-checkout-${user.id}-${barId}-${Math.floor(Date.now() / 600000)}` });
      if (!session.url) throw new Error("Checkout did not return a destination");
      return { url: session.url };
    });
    if ("active" in outcome) { res.status(409).json({ error: "This venue already has an active membership." }); return; }
    res.json(outcome);
  } catch { res.status(503).json({ error: "Checkout is unavailable. Please try again shortly." }); }
});

router.post("/bars/:barId/billing-portal", async (req, res) => {
  const barId = Number(req.params.barId);
  if (!Number.isSafeInteger(barId) || barId < 1) { res.status(400).json({ error: "Invalid bar" }); return; }
  if (!await requireBarOwner(req, res, barId)) return;
  const user = req.user;
  if (!user) { res.status(401).json({ error: "Sign in is required" }); return; }
  try {
    const membership = await getMembership(barId, user.id);
    if (!membership.subscription) { res.status(409).json({ error: "No active membership to manage." }); return; }
    const stripe = await getUncachableStripeClient();
    const customer = typeof membership.subscription.customer === "string" ? membership.subscription.customer : membership.subscription.customer.id;
    const session = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl(req) });
    res.json({ url: session.url });
  } catch { res.status(503).json({ error: "Billing management is unavailable." }); }
});

export default router;
