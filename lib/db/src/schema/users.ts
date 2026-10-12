import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  // PostgreSQL permits many NULL values in a unique column, preserving demo
  // records while guaranteeing each signed-in OIDC subject maps to one user.
  oidcSubject: text("oidc_subject").unique(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  isCurator: boolean("is_curator").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, clerkUserId: true, oidcSubject: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
