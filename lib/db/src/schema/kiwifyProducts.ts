import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const kiwifyProducts = pgTable("kiwify_products", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  name: text("name").default(""),
  type: text("type").default(""),
  status: text("status").default("active"),
  price: text("price").default("0"),
  currency: text("currency").default("BRL"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export type KiwifyProduct = typeof kiwifyProducts.$inferSelect;
