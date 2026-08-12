import { pgTable, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const talliesTable = pgTable("tallies", {
  id: serial("id").primaryKey(),
  drinkId: integer("drink_id").notNull(),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTallySchema = createInsertSchema(talliesTable).omit({ id: true, createdAt: true });
export type InsertTally = z.infer<typeof insertTallySchema>;
export type Tally = typeof talliesTable.$inferSelect;
