import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users, videoTransactions } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";

const router: IRouter = Router();

// Linha de corte comercial: não recupera compras antigas de teste.
const VIDEO_PURCHASE_RECOVERY_CUTOFF = Math.floor(
  new Date("2026-07-30T07:25:00.000Z").getTime() / 1000,
);

async function reconcilePendingVideoPurchases(
  clerkUserId: string,
  stripeCustomerId: string | null,
): Promise<void> {
  if (!stripeCustomerId) return;

  const stripe = await getUncachableStripeClient();
  const sessions = await stripe.checkout.sessions.list({
    customer: stripeCustomerId,
    limit: 30,
  });

  for (const session of sessions.data) {
    if (session.created < VIDEO_PURCHASE_RECOVERY_CUTOFF) continue;
    if (session.status !== "complete" || session.mode !== "payment") continue;
    if (session.metadata?.type !== "video_pack") continue;
    if (session.client_reference_id !== clerkUserId) continue;

    await reconcileCheckoutSession(session.id, clerkUserId);
  }
}

router.get("/videos/balance", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  let [user] = await db
    .select({
      videoBalance: users.videoBalance,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    await reconcilePendingVideoPurchases(clerkUserId, user.stripeCustomerId);

    [user] = await db
      .select({
        videoBalance: users.videoBalance,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.clerkId, clerkUserId));
  } catch (err) {
    req.log.error({ err, clerkUserId }, "Failed to reconcile pending video purchases");
  }

  res.json({ videoBalance: user?.videoBalance ?? 0 });
});

router.post(
  "/videos/use",
  requireAuth,
  requirePlan(["pro", "business", "agency"]),
  async (req, res): Promise<void> => {
    const { clerkUserId } = req as AuthenticatedRequest;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const currentBalance = user.videoBalance ?? 0;
    if (currentBalance <= 0) {
      res.status(402).json({ error: "insufficient_video_balance", balance: 0 });
      return;
    }

    const newBalance = currentBalance - 1;

    await db
      .update(users)
      .set({ videoBalance: newBalance, updatedAt: new Date() })
      .where(eq(users.clerkId, clerkUserId));

    await db.insert(videoTransactions).values({
      clerkUserId,
      amount: -1,
      type: "use",
      description: "Geração de vídeo",
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    res.json({ success: true, newBalance });
  },
);

export default router;
