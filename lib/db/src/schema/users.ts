import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const planEnum = pgEnum("plan", ["free", "pro", "business", "agency"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: userRoleEnum("role").notNull().default("user"),
  plan: planEnum("plan").notNull().default("free"),
  credits: integer("credits").notNull().default(0),
  creativeCredits: integer("creative_credits").notNull().default(0),
  betaAccess: boolean("beta_access").notNull().default(false),
  planSelected: boolean("plan_selected").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  extraCredits: integer("extra_credits").notNull().default(0),
  extraCreativeCredits: integer("extra_creative_credits").notNull().default(0),
  videoBalance: integer("video_balance").notNull().default(0),
  helpMessagesUsed: integer("help_messages_used").notNull().default(0),
  helpUsedResetAt: timestamp("help_used_reset_at"),
  registrationConfirmed: boolean("registration_confirmed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
