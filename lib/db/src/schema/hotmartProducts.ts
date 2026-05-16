import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const hotmartProducts = pgTable("hotmart_products", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  name: text("name").default(""),
  format: text("format").default(""),
  status: text("status").default("ACTIVE"),
  price: text("price").default("0"),
  currency: text("currency").default("BRL"),
  syncedAt: timestamp("synced_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export type HotmartProduct = typeof hotmartProducts.$inferSelect;
