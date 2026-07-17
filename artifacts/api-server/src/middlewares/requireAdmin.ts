import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export interface AdminRequest extends Request {
  clerkUserId: string;
  adminUserId: number;
}

const OWNER_EMAIL = "maxsantosmotta@gmail.com";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  const isOwner = user?.email?.trim().toLowerCase() === OWNER_EMAIL;
  const isAdmin = user?.role === "admin";

  if (!user || (!isAdmin && !isOwner)) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }

  (req as AdminRequest).clerkUserId = clerkUserId;
  (req as AdminRequest).adminUserId = user.id;
  next();
}
