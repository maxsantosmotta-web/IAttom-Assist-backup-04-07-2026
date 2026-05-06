import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const waitlistStatusEnum = pgEnum("waitlist_status", ["pending", "approved", "denied"]);

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  message: text("message"),
  status: waitlistStatusEnum("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});
