import { eq, count, sql } from "drizzle-orm";
import { db, users } from "@workspace/db";

async function shouldAutoPromote(email: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email.toLowerCase() === adminEmail) return true;
  const [{ value }] = await db.select({ value: count() }).from(users);
  return Number(value) === 0;
}

export async function getOrSyncUser(clerkId: string, email?: string, name?: string) {
  // ── 1. Look up by clerkId first ───────────────────────────────────────────
  const [byClerk] = await db.select().from(users).where(eq(users.clerkId, clerkId));

  if (byClerk) {
    // Always refresh mutable fields so Google-profile changes propagate.
    const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (email && byClerk.email !== email) updates.email = email;
    if (name && byClerk.name !== name) updates.name = name;

    // Check promotion only for non-admins.
    if (email && byClerk.role !== "admin") {
      const promote = await shouldAutoPromote(email);
      if (promote) {
        Object.assign(updates, {
          role: "admin" as const,
          betaAccess: true,
          plan: "pro" as const,
          credits: 500,
        });
      }
    }

    if (Object.keys(updates).length > 1) {
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.clerkId, clerkId))
        .returning();
      return updated;
    }
    return byClerk;
  }

  // ── 2. Look up by email — claim a stub seeded before Clerk auth ───────────
  if (email) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, email));
    if (byEmail) {
      // Attach the real Clerk ID to the stub record.
      const [claimed] = await db
        .update(users)
        .set({ clerkId, name: name ?? byEmail.name, updatedAt: new Date() })
        .where(eq(users.email, email))
        .returning();
      return claimed;
    }
  }

  // ── 3. Brand-new user — true UPSERT on clerk_id to survive retries ────────
  if (!email) return null;

  const promote = await shouldAutoPromote(email);

  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      email,
      name: name ?? null,
      ...(promote
        ? { role: "admin" as const, betaAccess: true, plan: "pro" as const, credits: 500 }
        : {}),
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: sql`EXCLUDED.email`,
        name: sql`COALESCE(EXCLUDED.name, ${users.name})`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return created;
}

export async function getAdminCount() {
  const [result] = await db.select({ count: count() }).from(users).where(eq(users.role, "admin"));
  return Number(result.count);
}
