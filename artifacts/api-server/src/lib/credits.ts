import { eq, count, sql } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";

export const FEATURE_COSTS = {
  product_discovery: 5,
  product_validation: 5,
  campaign: 10,
  content: 8,
  creativeImage1: 10,
  creativeImage2: 20,
  creativeImage3: 30,
  video_script: 10,
  prompt_creation: 5,
} as const;

export const PLAN_CREDITS = {
  free: 0,
  pro: 400,
  business: 1000,
  agency: 2300,
} as const;

export const PLAN_CREATIVE_CREDITS = {
  free: 0,
  pro: 100,
  business: 150,
  agency: 250,
} as const;

export type FeatureKey = keyof typeof FEATURE_COSTS;
export type PlanKey = keyof typeof PLAN_CREDITS;

export const CREATIVE_FEATURES = new Set<FeatureKey>([
  "creativeImage1",
  "creativeImage2",
  "creativeImage3",
]);

const DEBIT_DESCRIPTIONS: Record<string, string> = {
  product_discovery: "Uso do Buscador de Produtos",
  product_validation: "Uso do Validador de Produtos",
  campaign: "Uso do Criador de Campanha",
  content: "Uso do Criador de Conteúdo",
  creativeImage1: "Uso do Gerador Criativo (1 imagem)",
  creativeImage2: "Uso do Gerador Criativo (2 imagens)",
  creativeImage3: "Uso do Gerador Criativo (3 imagens)",
  video_script: "Uso do Gerador de Scripts",
  prompt_creation: "Criação de Prompt",
};

export async function getUserWithCredits(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  return user ?? null;
}

interface LockedCreditBalances {
  credits: number;
  extra_credits: number;
  creative_credits: number;
  extra_creative_credits: number;
}

export async function deductCredits(clerkId: string, feature: FeatureKey) {
  const cost = FEATURE_COSTS[feature];
  const isCreative = CREATIVE_FEATURES.has(feature);

  return db.transaction(async (tx) => {
    // Lock the user row so concurrent generations cannot spend the same balance.
    const lockedResult = await tx.execute(
      sql`SELECT credits, extra_credits, creative_credits, extra_creative_credits
          FROM users
          WHERE clerk_id = ${clerkId}
          FOR UPDATE`,
    );

    const locked = lockedResult.rows[0] as LockedCreditBalances | undefined;
    if (!locked) {
      return { success: false as const, error: "user_not_found" as const };
    }

    const planBalance = isCreative ? Number(locked.creative_credits) : Number(locked.credits);
    const extraBalance = isCreative ? Number(locked.extra_creative_credits) : Number(locked.extra_credits);
    const total = planBalance + extraBalance;

    if (total < cost) {
      return {
        success: false as const,
        error: "insufficient_credits" as const,
        balance: total,
        required: cost,
      };
    }

    const fromPlan = Math.min(cost, planBalance);
    const fromExtra = cost - fromPlan;
    const newPlanBalance = planBalance - fromPlan;
    const newExtraBalance = extraBalance - fromExtra;

    const updateFields = isCreative
      ? {
          creativeCredits: newPlanBalance,
          extraCreativeCredits: newExtraBalance,
          updatedAt: new Date(),
        }
      : {
          credits: newPlanBalance,
          extraCredits: newExtraBalance,
          updatedAt: new Date(),
        };

    const [updated] = await tx
      .update(users)
      .set(updateFields)
      .where(eq(users.clerkId, clerkId))
      .returning();

    const newTotal = total - cost;

    const [creditTransaction] = await tx
      .insert(creditsTransactions)
      .values({
        clerkUserId: clerkId,
        amount: -cost,
        type: "debit",
        feature,
        balanceType: isCreative ? "creative" : "general",
        description: DEBIT_DESCRIPTIONS[feature] ?? `Uso de ${feature.replace(/_/g, " ")}`,
        balanceBefore: total,
        balanceAfter: newTotal,
      })
      .returning();

    return {
      success: true as const,
      creditsUsed: cost,
      newBalance: newTotal,
      transactionId: creditTransaction.id,
      user: updated,
    };
  });
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

  const [creditTransaction] = await db
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

  return { user: updated, transaction: creditTransaction };
}

export async function getTransactionCount(clerkUserId: string) {
  const [res] = await db
    .select({ count: count() })
    .from(creditsTransactions)
    .where(eq(creditsTransactions.clerkUserId, clerkUserId));
  return res?.count ?? 0;
}
