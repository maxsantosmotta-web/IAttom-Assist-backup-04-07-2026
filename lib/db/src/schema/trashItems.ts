import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const trashItems = pgTable("trash_items", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  platform: text("platform").notNull(),
  itemType: text("item_type").notNull(),
  name: text("name").default(""),
  previousStatus: text("previous_status").default(""),
  snapshot: text("snapshot").default("{}"),
  deletedAt: timestamp("deleted_at").defaultNow(),
});

export type TrashItem = typeof trashItems.$inferSelect;
