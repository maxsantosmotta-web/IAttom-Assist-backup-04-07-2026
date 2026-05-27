import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const savedItemsTable = pgTable("saved_items_v2", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  platform: text("platform"),
  content: text("content").notNull().default(""),
  data: text("data"),
  imagesData: text("images_data"),
  hasImages: boolean("has_images").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  expiresAt: timestamp("expires_at"),
});

export type SavedItemRow = typeof savedItemsTable.$inferSelect;
