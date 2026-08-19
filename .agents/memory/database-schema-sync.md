---
name: Database schema sync
description: Safe handling of schema changes when Drizzle's non-interactive development sync suggests truncation.
---

Treat the checked-in schema and forward migrations as the source of truth. Use
Replit's Publish flow for production schema changes; do not create deploy-time
or application-startup DDL.

**Why:** Drizzle's non-interactive development sync can request truncation when
adding a uniqueness constraint to a table with existing rows, even where the
intended release change is additive. Accepting that suggestion would destroy
development data unnecessarily.

**How to apply:** Inspect the proposed schema change and preserve existing data.
For account/session changes, include a forward migration that safely backfills
or removes only invalid legacy session records before enforcing constraints.
Let the Publish flow apply the production schema diff and show any required
confirmation to the release owner.