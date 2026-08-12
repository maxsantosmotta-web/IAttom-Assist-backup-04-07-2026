import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Ledger isolado de compras Google Play.
 *
 * eventKey e unico por concessao, nao apenas por purchaseToken:
 * - produto unico: one-time:<purchaseToken>
 * - assinatura: subscription:<purchaseToken>:<latestSuccessfulOrderId|expiryTime>
 *
 * Isso impede concessao duplicada sem bloquear renovacoes legitimas da mesma assinatura.
 */
export const googlePlayPurchases = pgTable("google_play_purchases", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  purchaseToken: text("purchase_token").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  productId: text("product_id").notNull(),
  productType: text("product_type").notNull(),
  basePlanId: text("base_plan_id"),
  orderId: text("order_id"),
  entitlementType: text("entitlement_type").notNull(),
  entitlementAmount: integer("entitlement_amount").notNull().default(0),
  internalPlan: text("internal_plan"),
  googleState: text("google_state").notNull(),
  expiryTime: timestamp("expiry_time"),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
