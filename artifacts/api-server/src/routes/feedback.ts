import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, feedbackTable, users } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { z } from "zod/v4";

const router: IRouter = Router();

const SubmitFeedbackBody = z.object({
  message: z.string().min(1).max(2000),
  category: z.enum(["bug", "feature", "general", "other"]).default("general"),
  rating: z.number().int().min(1).max(5).optional(),
});

router.post("/feedback", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [entry] = await db
    .insert(feedbackTable)
    .values({
      clerkUserId,
      userEmail: user.email,
      userName: user.name ?? undefined,
      message: parsed.data.message,
      category: parsed.data.category,
      rating: parsed.data.rating ?? null,
    })
    .returning();

  res.status(201).json({ id: entry.id, message: "Feedback submitted" });
});

router.get("/feedback/mine", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const entries = await db
    .select()
    .from(feedbackTable)
    .where(eq(feedbackTable.clerkUserId, clerkUserId))
    .orderBy(desc(feedbackTable.createdAt))
    .limit(20);

  res.json({ feedback: entries });
});

export default router;
