import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const hotmartEvents = pgTable("hotmart_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type"),
  transactionId: text("transaction_id"),
  productId: text("product_id"),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  value: text("value"),
  currency: text("currency"),
  payload: jsonb("payload"),
  receivedAt: timestamp("received_at").defaultNow(),
});

export type HotmartEvent = typeof hotmartEvents.$inferSelect;
