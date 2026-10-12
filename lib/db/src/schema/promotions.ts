import { pgTable, serial, integer, text, timestamp, unique, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { barsTable } from "./bars";

// Editorial descriptions come from checked official sources, not copied Google data.
export const publicSpecialsTable = pgTable("public_specials", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").references(() => barsTable.id, { onDelete: "cascade" }),
  providerId: text("provider_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sourceUrl: text("source_url").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Place IDs may be retained. No Google name/address/photos or location history is saved.
export const placeFavoritesTable = pgTable("place_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("place_favorite_user_place").on(t.userId, t.providerId)]);

export const pushDevicesTable = pgTable("push_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promotionMessagesTable = pgTable("promotion_messages", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").notNull().references(() => barsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sent: boolean("sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
