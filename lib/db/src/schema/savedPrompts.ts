import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const savedPromptsTable = pgTable("saved_prompts", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  module: text("module").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  expiresAt: timestamp("expires_at"),
});

export type SavedPrompt = typeof savedPromptsTable.$inferSelect;
