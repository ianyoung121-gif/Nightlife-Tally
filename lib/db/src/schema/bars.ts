import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const barsTable = pgTable("bars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address"),
  coverImageUrl: text("cover_image_url"),
  ownerId: integer("owner_id"),
  subscriptionActive: boolean("subscription_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBarSchema = createInsertSchema(barsTable).omit({ id: true, createdAt: true });
export type InsertBar = z.infer<typeof insertBarSchema>;
export type Bar = typeof barsTable.$inferSelect;
