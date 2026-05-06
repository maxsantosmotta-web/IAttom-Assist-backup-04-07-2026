import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";
import { referralsTable, referralUsesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

const REFERRER_BONUS = 50;
const REFERRED_BONUS = 25;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
  return `${part1}-${part2}`;
}

router.get("/referral/my", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  try {
  let [referral] = await db.select().from(referralsTable).where(eq(referralsTable.clerkUserId, clerkUserId));

  if (!referral) {
    let code = generateCode();
    for (let i = 0; i < 10; i++) {
      const [existing] = await db.select().from(referralsTable).where(eq(referralsTable.code, code));
      if (!existing) break;
      code = generateCode();
    }
    [referral] = await db.insert(referralsTable).values({ clerkUserId, code }).returning();
  }

  const recentUses = await db
    .select({
      referredUserId: referralUsesTable.referredUserId,
      creditsAwarded: referralUsesTable.creditsAwarded,
      createdAt: referralUsesTable.createdAt,
    })
    .from(referralUsesTable)
    .where(eq(referralUsesTable.referrerUserId, clerkUserId))
    .orderBy(desc(referralUsesTable.createdAt))
    .limit(10);

  const host = req.get("host") ?? "localhost";
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");
  const shareUrl = `${proto}://${host}${basePath}/?ref=${referral.code}`;

  res.json({
    code: referral.code,
    shareUrl,
    totalUses: referral.totalUses,
    creditsEarned: referral.creditsEarned,
    referrerBonus: REFERRER_BONUS,
    referredBonus: REFERRED_BONUS,
    recentReferrals: recentUses.map((u) => ({
      referredUserId: u.referredUserId.slice(0, 8) + "***",
      creditsAwarded: u.creditsAwarded,
      createdAt: u.createdAt,
    })),
  });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch referral data");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/referral/use", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const { code } = req.body as { code?: string };

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const normalizedCode = code.toUpperCase().trim();

  try {
    const [alreadyReferred] = await db
      .select()
      .from(referralUsesTable)
      .where(eq(referralUsesTable.referredUserId, clerkUserId));

    if (alreadyReferred) {
      res.status(409).json({ error: "You have already used a referral code." });
      return;
    }

    const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.code, normalizedCode));
    if (!referral) {
      res.status(404).json({ error: "Invalid referral code." });
      return;
    }

    if (referral.clerkUserId === clerkUserId) {
      res.status(400).json({ error: "You cannot use your own referral code." });
      return;
    }

    const [[referredUser], [referrerUser]] = await Promise.all([
      db.select().from(users).where(eq(users.clerkId, clerkUserId)),
      db.select().from(users).where(eq(users.clerkId, referral.clerkUserId)),
    ]);

    if (!referredUser || !referrerUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ credits: referredUser.credits + REFERRED_BONUS })
        .where(eq(users.clerkId, clerkUserId));
      await tx.insert(creditsTransactions).values({
        clerkUserId,
        amount: REFERRED_BONUS,
        type: "credit",
        feature: "referral",
        description: `Referral bonus — joined via code ${normalizedCode}`,
        balanceBefore: referredUser.credits,
        balanceAfter: referredUser.credits + REFERRED_BONUS,
      });

      await tx
        .update(users)
        .set({ credits: referrerUser.credits + REFERRER_BONUS })
        .where(eq(users.clerkId, referral.clerkUserId));
      await tx.insert(creditsTransactions).values({
        clerkUserId: referral.clerkUserId,
        amount: REFERRER_BONUS,
        type: "credit",
        feature: "referral",
        description: `Referral reward — a friend joined with your code`,
        balanceBefore: referrerUser.credits,
        balanceAfter: referrerUser.credits + REFERRER_BONUS,
      });

      await tx.insert(referralUsesTable).values({
        referralCode: normalizedCode,
        referrerUserId: referral.clerkUserId,
        referredUserId: clerkUserId,
        creditsAwarded: REFERRER_BONUS,
      });

      await tx
        .update(referralsTable)
        .set({
          totalUses: referral.totalUses + 1,
          creditsEarned: referral.creditsEarned + REFERRER_BONUS,
        })
        .where(eq(referralsTable.code, normalizedCode));
    });

    res.json({ success: true, creditsAwarded: REFERRED_BONUS });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to apply referral code");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
