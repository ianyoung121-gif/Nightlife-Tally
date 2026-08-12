import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const drinksTable = pgTable("drinks", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  price: text("price"),
  tallyCount: integer("tally_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDrinkSchema = createInsertSchema(drinksTable).omit({ id: true, createdAt: true, tallyCount: true });
export type InsertDrink = z.infer<typeof insertDrinkSchema>;
export type Drink = typeof drinksTable.$inferSelect;
