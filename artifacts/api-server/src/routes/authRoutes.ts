import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getOrSyncUser, getAdminCount, getOrCreateUserFromClerk } from "../lib/userSync";
import { SyncUserBody, SyncUserResponse, GetMeResponse, BootstrapAdminResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/sync", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = SyncUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  req.log.info({ clerkUserId, email: parsed.data.email }, "[DEBUG] /auth/sync called");

  const user = await getOrSyncUser(clerkUserId, parsed.data.email, parsed.data.name);
  if (!user) { res.status(500).json({ error: "Failed to sync user" }); return; }

  req.log.info({ clerkUserId, dbUserId: user.id, role: user.role, plan: user.plan, credits: user.credits, email: user.email }, "[DEBUG] /auth/sync result");

  res.json(SyncUserResponse.parse(user));
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const user = await getOrCreateUserFromClerk(clerkUserId);
  if (!user) { res.status(500).json({ error: "Failed to resolve user from Clerk" }); return; }
  res.json(GetMeResponse.parse(user));
});

router.post("/user/select-plan", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [updated] = await db
    .update(users)
    .set({ planSelected: true, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId))
    .returning();
  res.json({ ok: true, plan: updated.plan, planSelected: updated.planSelected });
});

router.post("/admin/bootstrap", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const adminCount = await getAdminCount();
  if (adminCount > 0) { res.status(409).json({ error: "Admins already exist." }); return; }

  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (!existing) { res.status(404).json({ error: "Sync first." }); return; }

  const [updated] = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId))
    .returning();

  res.json(BootstrapAdminResponse.parse(updated));
});

export default router;
