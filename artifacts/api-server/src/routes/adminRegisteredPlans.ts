import { Router, type IRouter } from "express";
import { db, users } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

router.get("/admin/registered-plan-stats", requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({ plan: users.plan })
      .from(users);

    const planBreakdown = {
      free: rows.filter((user) => user.plan === "free").length,
      pro: rows.filter((user) => user.plan === "pro").length,
      business: rows.filter((user) => user.plan === "business").length,
      agency: rows.filter((user) => user.plan === "agency").length,
    };

    res.json({
      totalUsers: rows.length,
      planBreakdown,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch registered plan stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
