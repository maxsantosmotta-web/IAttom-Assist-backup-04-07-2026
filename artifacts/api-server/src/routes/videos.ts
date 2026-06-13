import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users, videoTransactions } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { requirePlan } from "../middlewares/requirePlan.js";

const router: IRouter = Router();

router.get("/videos/balance", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const [user] = await db
    .select({ videoBalance: users.videoBalance })
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ videoBalance: user.videoBalance ?? 0 });
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
