---
name: Stripe managed proxy
description: New Stripe connections authenticate without exposing API keys; old credential templates can misdiagnose them.
---

Use the connected Stripe SDK proxy for authentication. Absence of secret_key fields in the older connection endpoint does not mean the connection needs reauthorization.

**Why:** The active Stripe connection returned no keys to the legacy credential template, but authenticated account, product, price, and webhook requests succeeded through the managed proxy.

**How to apply:** Stripe SDK and schema-sync requests must use the proxy transport. Any local SDK bookkeeping identifier is not an API credential and must never be sent as provider authorization. Managed webhook signature verification still uses the real signing secret stored by the sync library.

Keep sandbox testing separate from live billing. A successful sandbox checkout is not proof that live charges are enabled; complete Replit Integrated Payments activation before publishing paid tools.

**Why:** The connected account supported a test-mode $5 plan but reported live charges disabled.

**How to apply:** Check mode and account readiness, and provision the real plan in the environment supplied by the connection rather than copying test price IDs into production.
