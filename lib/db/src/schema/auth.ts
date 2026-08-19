import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Authentication sessions are server-side so neither browser nor mobile code
// receives an OIDC access token.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("IDX_session_expire").on(table.expire),
    index("IDX_session_user_id").on(table.userId),
  ],
);