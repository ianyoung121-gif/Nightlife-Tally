---
name: EAS monorepo upload
description: How to build the Expo app from the pnpm monorepo when Git is unavailable.
---

When Git is unavailable, set `EAS_NO_VCS=1` and point `EAS_PROJECT_ROOT` at the full pnpm workspace root while launching EAS from the Expo app directory.

**Why:** Starting EAS from the app subdirectory alone omits the root lockfile and workspace catalog, causing the cloud builder to fall back to Yarn, which cannot resolve pnpm `catalog:` dependencies.

**How to apply:** Keep `eas.json` and the Expo app config in the mobile directory, but upload with the workspace root as `EAS_PROJECT_ROOT` so the cloud build receives the root workspace files and shared packages.