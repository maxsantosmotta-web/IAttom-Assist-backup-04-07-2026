import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, historyTable, users } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();
const ACTION_PREFIX = "Vídeo com Efeito gerado • requestId:";

router.get("/image-motion/result/:requestId", requireAuth, async (req, res, next): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const requestId = String(req.params.requestId ?? "").trim();

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.clerkId, authReq.clerkUserId));

  if (user?.role !== "admin" || !requestId) {
    next();
    return;
  }

  res.once("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    void db.transaction(async (tx) => {
      const action = `${ACTION_PREFIX}${requestId}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${authReq.clerkUserId}:${requestId}:video-effect-analytics`}))`);

      const [existing] = await tx
        .select({ id: historyTable.id })
        .from(historyTable)
        .where(and(
          eq(historyTable.clerkUserId, authReq.clerkUserId),
          eq(historyTable.action, action),
        ))
        .limit(1);

      if (existing) return;

      await tx.insert(historyTable).values({
        clerkUserId: authReq.clerkUserId,
        action,
        module: "video_effect",
        projectName: "Vídeo com Efeito",
      });
    }).catch((error: unknown) => {
      req.log.error({ err: error, requestId }, "failed to record admin video-effect completion");
    });
  });

  next();
});

export default router;
