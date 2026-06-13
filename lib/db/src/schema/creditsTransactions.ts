import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const creditTypeEnum = pgEnum("credit_type", ["initial", "credit", "debit", "adjustment", "refund"]);

export const creditsTransactions = pgTable("credits_transactions", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  amount: integer("amount").notNull(),
  type: creditTypeEnum("type").notNull(),
  feature: text("feature"),
  balanceType: text("balance_type"),
  description: text("description").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
