import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").notNull(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed' | 'freeitem' | 'bogo'
  discountValue: text("discount_value"),          // e.g. "20", "$5", "Free Shot"
  expiresAt: text("expires_at"),                  // ISO date string
  maxUses: integer("max_uses"),                   // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCouponSchema = createInsertSchema(couponsTable).omit({
  id: true,
  createdAt: true,
  usedCount: true,
  code: true,
});
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;
