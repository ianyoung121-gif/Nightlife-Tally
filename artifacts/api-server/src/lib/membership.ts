import { pool } from "@workspace/db";
import type Stripe from "stripe";

export function isOwnerSubscription(subscription: Stripe.Subscription, barId: number, ownerId: number): boolean {
  return subscription.status === "active"
    && subscription.metadata?.weekenderBarId === String(barId)
    && subscription.metadata?.weekenderUserId === String(ownerId)
    && subscription.items.data.some((item) => item.price.lookup_key === "weekender_owner_monthly"
      && item.price.unit_amount === 500 && item.price.currency === "usd"
      && item.price.recurring?.interval === "month");
}

export async function getMembership(barId: number, ownerId: number) {
  const result = await pool.query(
    `SELECT _raw_data FROM stripe.subscriptions
     WHERE _raw_data->'metadata'->>'weekenderBarId' = $1
       AND _raw_data->'metadata'->>'weekenderUserId' = $2
     ORDER BY (_raw_data->>'created')::bigint DESC`,
    [String(barId), String(ownerId)],
  );
  const active = result.rows.find((row) => isOwnerSubscription(row._raw_data, barId, ownerId))?._raw_data as Stripe.Subscription | undefined;
  return { active: Boolean(active), subscription: active };
}
