import Stripe from "stripe";
import { StripeSync, runMigrations } from "stripe-replit-sync";
import { ReplitConnectors } from "@replit/connectors-sdk";

export async function getUncachableStripeClient() {
  // New connections authenticate through the managed proxy, not exposed keys.
  // This marker is local SDK bookkeeping; it is NEVER sent to Stripe.
  const connectors = new ReplitConnectors();
  return new Stripe("replit-managed-stripe-connection", {
    maxNetworkRetries: 1,
    httpClient: Stripe.createFetchHttpClient(async (url, init) => {
      const target = new URL(String(url));
      if (target.hostname !== "api.stripe.com") throw new Error("Invalid Stripe request target");
      const headers = new Headers(init?.headers);
      headers.delete("authorization");
      return connectors.proxy("stripe", `${target.pathname}${target.search}`, {
        method: init?.method,
        body: init?.body,
        headers: Object.fromEntries(headers.entries()),
      });
    }),
  });
}

let syncPromise: Promise<StripeSync> | undefined;
async function createStripeSync() {
  const sync = new StripeSync({
    poolConfig: { connectionString: process.env.DATABASE_URL },
    stripeSecretKey: "replit-managed-stripe-connection",
    stripeWebhookSecret: "",
  });
  // Sync uses the same proxy-authenticated client. The library stores and uses
  // the real managed webhook signing secret internally in its Stripe schema.
  sync.stripe = await getUncachableStripeClient();
  return sync;
}

export function getStripeSync(): Promise<StripeSync> {
  // Reuse its connection pool across webhook and checkout requests.
  return syncPromise ??= createStripeSync().catch((error) => {
    syncPromise = undefined;
    throw error;
  });
}
/** Provision in whichever Stripe environment the managed connection supplies. */
export async function ensureOwnerPlan() {
  const stripe = await getUncachableStripeClient();
  const prices = await stripe.prices.list({ lookup_keys: ["weekender_owner_monthly"], active: true });
  if (prices.data.length) {
    const price = prices.data[0];
    if (price.unit_amount !== 500 || price.currency !== "usd" || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
      throw new Error("Venue owner price must be USD $5 per month");
    }
  } else {
    const product = await stripe.products.create({
      name: "Weekender Venue Owner",
      description: "Publish venue specials and notify opted-in followers.",
      metadata: { weekenderPlan: "venue_owner" },
    }, { idempotencyKey: "weekender-owner-product" });
    await stripe.prices.create({
      product: product.id, lookup_key: "weekender_owner_monthly",
      currency: "usd", unit_amount: 500, recurring: { interval: "month" },
      metadata: { weekenderPlan: "venue_owner" },
    }, { idempotencyKey: "weekender-owner-monthly-price" });
  }
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 1 });
  if (!configurations.data.length) {
    await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Manage your Weekender venue membership" },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
      },
    });
  }
}

export async function initializeStripe() {
  if (!process.env.REPLIT_CONNECTORS_HOSTNAME) return;
  if (!process.env.DATABASE_URL) throw new Error("Stripe requires the application database");
  // This package manages only its own Stripe sync schema; application schema is
  // applied to production by Replit Publish, never by startup-time migrations.
  await runMigrations({ databaseUrl: process.env.DATABASE_URL });
  const sync = await getStripeSync();
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const publicUrl = process.env.WEEKENDER_PUBLIC_URL;
  if (!publicUrl && (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1")) {
    throw new Error("Published app URL is required for billing webhooks");
  }
  const origin = publicUrl ?? (domain ? `https://${domain}` : null);
  if (!origin || new URL(origin).protocol !== "https:") throw new Error("Stripe webhook domain is unavailable");
  await sync.findOrCreateManagedWebhook(`${new URL(origin).origin}/api/stripe/webhook`);
  await ensureOwnerPlan();
  await sync.syncBackfill({ object: "all" });
}
