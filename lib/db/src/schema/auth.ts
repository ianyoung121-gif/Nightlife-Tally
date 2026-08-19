import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Authentication sessions are server-side so neither browser nor mobile code
// receives an OIDC access token.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { withTimezone: true }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);