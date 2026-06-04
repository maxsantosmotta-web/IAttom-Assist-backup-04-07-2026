import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, historyTable } from "@workspace/db";
import { ListHistoryQueryParams, ListHistoryResponse } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/history", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = ListHistoryQueryParams.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 20;

  const items = await db
    .select()
    .from(historyTable)
    .where(eq(historyTable.clerkUserId, clerkUserId))
    .orderBy(desc(historyTable.createdAt))
    .limit(limit);

  res.json(ListHistoryResponse.parse(items.map((item) => ({
    ...item,
    projectId: item.projectId ?? undefined,
    projectName: item.projectName ?? undefined,
  }))));
});

export default router;
