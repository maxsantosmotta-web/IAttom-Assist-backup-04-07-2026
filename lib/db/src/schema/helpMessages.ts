import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const helpMessages = pgTable("help_messages", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  imageUrls: text("image_urls"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type HelpMessage = typeof helpMessages.$inferSelect;
export type InsertHelpMessage = typeof helpMessages.$inferInsert;
