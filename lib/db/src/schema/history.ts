import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const historyTable = pgTable("history", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }),
  projectName: text("project_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  expiresAt: timestamp("expires_at"),
});

export const insertHistorySchema = createInsertSchema(historyTable).omit({
  id: true,
  clerkUserId: true,
  createdAt: true,
});

export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;
