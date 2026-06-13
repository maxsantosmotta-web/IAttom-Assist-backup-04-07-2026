import { eq, count } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";

export const FEATURE_COSTS = {
  product_discovery: 5,
  product_validation: 5,
  campaign: 10,
  content: 8,
  creativeImage1: 10,
  creativeImage2: 15,
  creativeImage3: 20,
  creativeVideo20: 40,
  video_script: 10,
} as const;

export const PLAN_CREDITS = {
  free: 0,
  pro: 700,
  business: 1500,
  agency: 3250,
} as const;

export type FeatureKey = keyof typeof FEATURE_COSTS;
export type PlanKey = keyof typeof PLAN_CREDITS;

export async function getUserWithCredits(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  return user ?? null;
}

export async function deductCredits(clerkId: string, feature: FeatureKey) {
  const cost = FEATURE_COSTS[feature];
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));

  if (!user) return { success: false as const, error: "user_not_found" as const };

  if (user.credits < cost) {
    return {
      success: false as const,
      error: "insufficient_credits" as const,
      balance: user.credits,
      required: cost,
    };
  }

  const balanceBefore = user.credits;
  const balanceAfter = balanceBefore - cost;

  const [updated] = await db
    .update(users)
    .set({ credits: balanceAfter, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId))
    .returning();

  const [tx] = await db
    .insert(creditsTransactions)
    .values({
      clerkUserId: clerkId,
      amount: -cost,
      type: "debit",
      feature,
      description: ({
        product_discovery: "Uso do Buscador de Produtos",
        product_validation: "Uso do Validador de Produtos",
        campaign: "Uso do Criador de Campanha",
        content: "Uso do Criador de Conteúdo",
        creativeImage1: "Uso do Gerador Criativo (1 imagem)",
        creativeImage2: "Uso do Gerador Criativo (2 imagens)",
        creativeImage3: "Uso do Gerador Criativo (3 imagens)",
        creativeVideo20: "Uso do Gerador de Vídeo (20s)",
        video_script: "Uso do Gerador de Scripts",
      } as Record<string, string>)[feature] ?? `Uso de ${feature.replace(/_/g, " ")}`,
      balanceBefore,
      balanceAfter,
    })
    .returning();

  return {
    success: true as const,
    creditsUsed: cost,
    newBalance: balanceAfter,
    transactionId: tx.id,
    user: updated,
  };
}

export async function adjustCredits(
  clerkId: string,
  amount: number,
  description: string,
  type: "credit" | "adjustment" | "initial" | "refund" = "adjustment",
) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (!user) return null;

  const balanceBefore = user.credits;
  const balanceAfter = Math.max(0, balanceBefore + amount);

  const [updated] = await db
    .update(users)
    .set({ credits: balanceAfter, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId))
    .returning();

  const [tx] = await db
    .insert(creditsTransactions)
    .values({
      clerkUserId: clerkId,
      amount,
      type,
      description,
      balanceBefore,
      balanceAfter,
    })
    .returning();

  return { user: updated, transaction: tx };
}

export async function getTransactionCount(clerkUserId: string) {
  const [res] = await db
    .select({ count: count() })
    .from(creditsTransactions)
    .where(eq(creditsTransactions.clerkUserId, clerkUserId));
  return res?.count ?? 0;
}
