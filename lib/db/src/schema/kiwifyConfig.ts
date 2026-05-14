import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const kiwifyConfig = pgTable("kiwify_config", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull().default(""),
  clientId: text("client_id").notNull().default(""),
  clientSecret: text("client_secret").notNull().default(""),
  webhookSecret: text("webhook_secret").notNull().default(""),
  accessToken: text("access_token").default(""),
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type KiwifyConfig = typeof kiwifyConfig.$inferSelect;
export type NewKiwifyConfig = typeof kiwifyConfig.$inferInsert;
