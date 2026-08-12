import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const specialsTable = pgTable("specials", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  validUntil: text("valid_until"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSpecialSchema = createInsertSchema(specialsTable).omit({ id: true, createdAt: true });
export type InsertSpecial = z.infer<typeof insertSpecialSchema>;
export type Special = typeof specialsTable.$inferSelect;
