# The Weekender

A going-out companion app where bar patrons tally drinks at local bars to discover what's hot tonight. Bars can create profiles with weekly specials. Club-vibe UI with neon colors on dark backgrounds.

## Run & Operate

- `pnpm --filter @workspace/weekender run dev` — run the frontend (auto-assigned port)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (pre-configured)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS, Framer Motion, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v3), drizzle-zod
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — Drizzle table definitions (bars, drinks, tallies, users, specials, barFollows)
- `artifacts/api-server/src/routes/` — Express route handlers (bars, drinks, specials, follows, stats, users)
- `artifacts/weekender/src/` — React frontend (pages, components)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — auto-generated Zod schemas (do not edit)

## Architecture decisions

- No auth on first build — userId=1 / barId=1 are hardcoded as demo "owner" and "patron" for the dashboard and profile pages.
- All integer fields in OpenAPI spec use `type: number` (not `type: integer`) because Orval 8.x generates `zod.int()` which is Zod v4 syntax; workspace uses Zod v3.
- `tallyCount` is an in-row counter on the drinks table for fast reads, plus a `tallies` table for per-user history.
- Bar follower counts are computed live from `bar_follows` table on each request (small scale).

## Product

- Patrons discover bars and tally drinks to show popularity
- Bar owners pay $5/month for a verified profile with specials and follower notifications
- Key interactions: tally a drink (pulse animation), follow a bar, view trending leaderboard

## User preferences

- Club-vibe UI: dark backgrounds (#0A0A0F), hot pink neon, electric purple, cyan accents
- No emojis anywhere in the UI
- Fun, energetic — makes someone feel like going out

## Gotchas

- After any OpenAPI spec change, run codegen before touching frontend code
- Use `type: number` not `type: integer` in the OpenAPI spec (Zod v3 compatibility)
- `db.$count()` returns a string — always wrap in `Number()`
- Drizzle increment: use `drinksTable.tallyCount + 1` with `as any` cast for the update

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
