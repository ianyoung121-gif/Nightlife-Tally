import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { barsTable } from "./bars";

// Only short-lived, encrypted OAuth material is stored, never Google passwords.
export const googleBusinessSessionsTable = pgTable("google_business_sessions", {
  hash: text("hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  barId: integer("bar_id").notNull().references(() => barsTable.id, { onDelete: "cascade" }),
  browserHash: text("browser_hash").notNull(),
  phase: text("phase").notNull(),
  encryptedPayload: text("encrypted_payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const googleVenueLinksTable = pgTable("google_venue_links", {
  barId: integer("bar_id").primaryKey().references(() => barsTable.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().unique(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const insertGoogleBusinessSessionSchema = createInsertSchema(googleBusinessSessionsTable);
export const insertGoogleVenueLinkSchema = createInsertSchema(googleVenueLinksTable);
export type InsertGoogleBusinessSession = z.infer<typeof insertGoogleBusinessSessionSchema>;
export type InsertGoogleVenueLink = z.infer<typeof insertGoogleVenueLinkSchema>;
