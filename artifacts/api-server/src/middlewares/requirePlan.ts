import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth.js";

export function requirePlan(allowedPlans: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [user] = await db
      .select({ plan: users.plan, role: users.role })
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    if (user.role === "admin") {
      next();
      return;
    }
    if (!allowedPlans.includes(user.plan)) {
      res.status(403).json({
        error: "plan_required",
        requiredPlans: allowedPlans,
        currentPlan: user.plan,
      });
      return;
    }
    next();
  };
}
