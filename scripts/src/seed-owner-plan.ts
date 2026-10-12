import { ensureOwnerPlan, getStripeSync } from "./stripeClient";

await ensureOwnerPlan();
const sync = await getStripeSync();
await sync.syncBackfill({ object: "all" });
console.log("Venue owner plan ready: USD $5/month. No customers charged.");
