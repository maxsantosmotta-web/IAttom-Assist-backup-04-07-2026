import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const mlProducts = pgTable("ml_products", {
  id: serial("id").primaryKey(),
  mlItemId: text("ml_item_id").notNull().unique(),
  title: text("title").default(""),
  price: text("price").default("0"),
  availableQuantity: integer("available_quantity").default(0),
  status: text("status").default("active"),
  categoryId: text("category_id").default(""),
  permalink: text("permalink").default(""),
  syncedAt: timestamp("synced_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export type MLProduct = typeof mlProducts.$inferSelect;
