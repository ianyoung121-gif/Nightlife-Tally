import { pgTable, serial, timestamp, integer, unique, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const barFollowsTable = pgTable("bar_follows", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").notNull(),
  userId: integer("user_id").notNull(),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("bar_follows_unique").on(t.barId, t.userId),
]);

export const insertBarFollowSchema = createInsertSchema(barFollowsTable).omit({ id: true, createdAt: true });
export type InsertBarFollow = z.infer<typeof insertBarFollowSchema>;
export type BarFollow = typeof barFollowsTable.$inferSelect;
