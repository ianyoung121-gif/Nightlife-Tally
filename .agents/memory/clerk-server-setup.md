---
name: Clerk server setup
description: Compatibility note for configuring Clerk middleware in this workspace.
---

Use `clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY })` for the server.

**Why:** The installed `@clerk/shared` package does not export the `publishableKeyFromHost` helper referenced by older setup material, so importing it causes the API build to fail.

**How to apply:** Keep the production Clerk proxy middleware for deployed requests, but use the configured publishable key directly unless the installed SDK explicitly provides a compatible host-resolution helper.