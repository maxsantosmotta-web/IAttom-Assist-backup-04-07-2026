import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const feedbackCategoryEnum = pgEnum("feedback_category", ["bug", "feature", "general", "other"]);
export const feedbackStatusEnum = pgEnum("feedback_status", ["new", "reviewed", "resolved"]);

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  message: text("message").notNull(),
  category: feedbackCategoryEnum("category").notNull().default("general"),
  rating: integer("rating"),
  status: feedbackStatusEnum("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});
