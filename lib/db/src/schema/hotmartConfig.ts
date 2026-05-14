import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const hotmartConfig = pgTable("hotmart_config", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull().default(""),
  clientSecret: text("client_secret").notNull().default(""),
  basicToken: text("basic_token").notNull().default(""),
  webhookToken: text("webhook_token").notNull().default(""),
  environment: text("environment").notNull().default("sandbox"),
  isActive: boolean("is_active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type HotmartConfig = typeof hotmartConfig.$inferSelect;
export type NewHotmartConfig = typeof hotmartConfig.$inferInsert;
