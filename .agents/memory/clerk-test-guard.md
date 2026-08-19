---
name: Clerk middleware test guard
description: clerkMiddleware throws when CLERK_SECRET_KEY is absent; must be guarded for test/dev server runs.
---

The `@clerk/express` `clerkMiddleware` throws "Missing Clerk Secret Key" and returns a 500 HTML error on every request when `CLERK_SECRET_KEY` is not set in the environment — even though the app's own session-based `authMiddleware` does not need Clerk at all.

**Why:** In test and dev environments the secret is absent, making every API request fail before reaching any route handler. This blocks integration tests that spin up a real server.

**How to apply:** In `artifacts/api-server/src/app.ts`, wrap the `clerkMiddleware` registration with:

```ts
if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY }));
}
app.use(authMiddleware); // always runs — owns session identity
```

Test servers spawned without `CLERK_SECRET_KEY` (or with it set to empty string) will work correctly because `authMiddleware` still resolves sessions from the database.
