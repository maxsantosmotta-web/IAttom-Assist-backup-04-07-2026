import { Router, type IRouter } from "express";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db, historyTable, savedItemsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const [[projects], [actions]] = await Promise.all([
    db
      .select({
        count: count(),
        withImages: sql<number>`count(*) filter (
          where ${savedItemsTable.hasImages} = true
            or coalesce(${savedItemsTable.imagesData}, '') not in ('', '[]')
        )::int`,
        withVideos: sql<number>`count(*) filter (
          where coalesce(${savedItemsTable.videosData}, '') not in ('', '[]')
        )::int`,
      })
      .from(savedItemsTable)
      .where(and(eq(savedItemsTable.clerkUserId, clerkUserId), isNull(savedItemsTable.deletedAt))),
    db
      .select({ count: count() })
      .from(historyTable)
      .where(and(eq(historyTable.clerkUserId, clerkUserId), isNull(historyTable.deletedAt))),
  ]);

  const summary = {
    totalProjects: projects.count,
    activeProjects: projects.withVideos ?? 0,
    completedProjects: projects.withImages ?? 0,
    totalActions: actions.count,
    recentProjects: [],
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
