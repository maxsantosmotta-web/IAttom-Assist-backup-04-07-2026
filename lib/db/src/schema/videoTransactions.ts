import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const videoTransactionTypeEnum = pgEnum("video_transaction_type", ["purchase", "use", "adjustment"]);

export const videoTransactions = pgTable("video_transactions", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  amount: integer("amount").notNull(),
  type: videoTransactionTypeEnum("type").notNull(),
  packId: text("pack_id"),
  description: text("description").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
