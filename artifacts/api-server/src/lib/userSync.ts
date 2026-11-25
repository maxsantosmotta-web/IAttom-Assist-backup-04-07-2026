import { eq, count } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { clerkClient } from "@clerk/express";

// Returns true if this user should receive automatic admin + full access.
// Two triggers:
//   1. ADMIN_EMAIL env var matches (case-insensitive) — works even after other users exist.
//   2. The database currently has zero users (first-ever sign-up).
async function shouldAutoPromote(email: string): Promise<boolean> {
  // The ChatGPT operational sandbox starts with an empty users table. Its
  // first normal login must not silently become a paid administrator.
  if (process.env.RAILWAY_PROJECT_ID === "0ded634b-c643-4655-b252-60c438c10b62" &&
      process.env.RAILWAY_ENVIRONMENT_ID === "32965107-60c2-4259-966b-38f8fed7a00b" &&
      process.env.RAILWAY_SERVICE_ID === "16a13f32-b8e5-4e0a-b2ed-526164375e82") return false;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email.toLowerCase() === adminEmail) return true;

  // count() returns a string from PostgreSQL bigint — use Number() for safe comparison.
  const [{ value }] = await db.select({ value: count() }).from(users);
  return Number(value) === 0;
}

export async function getOrSyncUser(clerkId: string, email?: string, name?: string) {
  // If a stub record was pre-created by email (no Clerk ID yet), claim it now.
  if (email) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    if (byEmail && byEmail.clerkId !== clerkId) {
      // Claim the pre-seeded stub and attach the real Clerk ID.
      const [claimed] = await db
        .update(users)
        .set({ clerkId, name: name ?? byEmail.name, updatedAt: new Date() })
        .where(eq(users.email, email))
        .returning();
      return claimed;
    }
  }

  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId));

  if (existing) {
    // If the user exists but hasn't been promoted yet, check if they qualify.
    if (email && existing.role !== "admin") {
      const promote = await shouldAutoPromote(email);
      if (promote) {
        const [updated] = await db
          .update(users)
          .set({ role: "admin", betaAccess: true, plan: "pro", credits: 500, registrationConfirmed: true, updatedAt: new Date() })
          .where(eq(users.clerkId, clerkId))
          .returning();
        return updated;
      }
    }
    return existing;
  }

  if (!email) return null;

  const promote = await shouldAutoPromote(email);

  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      email,
      name: name ?? null,
      ...(promote
        ? { role: "admin" as const, betaAccess: true, plan: "pro" as const, credits: 500, registrationConfirmed: true }
        : {}),
    })
    .returning();
  return created;
}

export async function getAdminCount() {
  const [result] = await db.select({ count: count() }).from(users).where(eq(users.role, "admin"));
  return Number(result.count);
}

/**
 * Garante que qualquer usuário autenticado pelo Clerk tenha registro no DB.
 * Busca email/name direto da API do Clerk e chama getOrSyncUser.
 * Usado por /auth/me e /credits/balance para eliminar usuários fantasma.
 */
export async function getOrCreateUserFromClerk(clerkUserId: string) {
  // Fast-path: usuário já existe — não chama API do Clerk
  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (existing) return existing;

  // Não existe no DB — buscar dados no Clerk para criar
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined;

  if (!email) return null;

  return getOrSyncUser(clerkUserId, email, name);
}
