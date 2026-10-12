import { pool } from "@workspace/db";
import { getStripeSync, getUncachableStripeClient } from "../stripeClient";

/** Caller holds the user row lock, shared with checkout creation. */
export async function cancelAccountMemberships(userId: number): Promise<void> {
  const [subscriptions, customers] = await Promise.all([
    pool.query<{ id: string }>("SELECT id FROM stripe.subscriptions WHERE _raw_data->'metadata'->>'weekenderUserId' = $1", [String(userId)]),
    pool.query<{ id: string }>("SELECT id FROM stripe.customers WHERE _raw_data->'metadata'->>'weekenderUserId' = $1", [String(userId)]),
  ]);
  if (!subscriptions.rows.length && !customers.rows.length) return;
  const stripe = await getUncachableStripeClient();
  const sync = await getStripeSync();
  const subscriptionIds = new Set(subscriptions.rows.map((row) => row.id));
  for (const customer of customers.rows) {
    // A pending payment link must not create recurring charges after deletion.
    for await (const session of stripe.checkout.sessions.list({ customer: customer.id, status: "open", limit: 100 })) {
      if (session.metadata?.weekenderUserId !== String(userId)) continue;
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (error) {
        const current = await stripe.checkout.sessions.retrieve(session.id);
        if (current.status === "open") throw error;
        if (typeof current.subscription === "string") subscriptionIds.add(current.subscription);
      }
    }
    // Read Stripe directly so a delayed webhook cannot hide a paid membership.
    for await (const subscription of stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 })) {
      if (subscription.metadata.weekenderUserId === String(userId)) subscriptionIds.add(subscription.id);
    }
  }
  for (const id of subscriptionIds) {
    const subscription = await stripe.subscriptions.retrieve(id);
    if (subscription.metadata.weekenderUserId !== String(userId)) throw new Error("Membership ownership changed");
    if (!["canceled", "incomplete_expired"].includes(subscription.status)) await stripe.subscriptions.cancel(id);
    await sync.syncSingleEntity(id);
  }
}
