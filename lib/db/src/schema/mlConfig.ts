import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const mlConfig = pgTable("ml_config", {
  id: serial("id").primaryKey(),
  appId: text("app_id").notNull().default(""),
  clientSecret: text("client_secret").notNull().default(""),
  accessToken: text("access_token").default(""),
  refreshToken: text("refresh_token").default(""),
  tokenExpiry: timestamp("token_expiry"),
  userId: text("user_id").default(""),
  nickname: text("nickname").default(""),
  siteId: text("site_id").default("MLB"),
  redirectUri: text("redirect_uri").default(""),
  isActive: boolean("is_active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MLConfig = typeof mlConfig.$inferSelect;
export type NewMLConfig = typeof mlConfig.$inferInsert;
