---
name: EAS monorepo upload
description: EAS monorepo uploads and external GitHub connection pitfalls.
---

When Git is unavailable, set `EAS_NO_VCS=1` and point `EAS_PROJECT_ROOT` at the full pnpm workspace root while launching EAS from the Expo app directory.

**Why:** Starting EAS from the app subdirectory alone omits the root lockfile and workspace catalog, causing the cloud builder to fall back to Yarn, which cannot resolve pnpm `catalog:` dependencies.

**How to apply:** Keep `eas.json` and the Expo app config in the mobile directory, but upload with the workspace root as `EAS_PROJECT_ROOT` so the cloud build receives the root workspace files and shared packages.

## GitHub-triggered builds

Verify Expo's linked repository independently of Replit's Git remote. Multiple similarly named repositories exist; successful authentication and build-history access do not verify the repository association.

**Why:** Build creation repeatedly returned a generic GraphQL 503 while Expo was linked to a different repository. Linking the repository containing the current code and saving the mobile base directory allowed a build to start.

**How to apply:** Before diagnosing a recurring build-trigger 503 as an outage, inspect Expo's Project GitHub settings and compare its repository against the actual pushed source. A 503 alone is not proof of the cause.