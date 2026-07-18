import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc } from "drizzle-orm";
import { createHash, randomInt } from "node:crypto";
import { db, users, emailVerifications } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getOrSyncUser, getAdminCount, getOrCreateUserFromClerk } from "../lib/userSync";
import { SyncUserBody, SyncUserResponse, GetMeResponse, BootstrapAdminResponse } from "@workspace/api-zod";
import { sendOtpEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/auth/sync", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = SyncUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  req.log.info({ clerkUserId, email: parsed.data.email }, "[DEBUG] /auth/sync called");

  const user = await getOrSyncUser(clerkUserId, parsed.data.email, parsed.data.name);
  if (!user) { res.status(500).json({ error: "Failed to sync user" }); return; }

  req.log.info({ clerkUserId, dbUserId: user.id, role: user.role, plan: user.plan, credits: user.credits, email: user.email }, "[DEBUG] /auth/sync result");

  res.json(SyncUserResponse.parse({ ...user, name: user.name ?? undefined }));
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const user = await getOrCreateUserFromClerk(clerkUserId);
  if (!user) { res.status(500).json({ error: "Failed to resolve user from Clerk" }); return; }
  res.json(GetMeResponse.parse({ ...user, name: user.name ?? undefined }));
});

router.post("/user/select-plan", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const protectedPaidStatuses = new Set(["active", "trialing", "past_due"]);
  const hasProtectedPaidSubscription =
    user.plan !== "free" &&
    !!user.stripeSubscriptionId &&
    !!user.stripeSubscriptionStatus &&
    protectedPaidStatuses.has(user.stripeSubscriptionStatus);

  if (hasProtectedPaidSubscription) {
    res.status(409).json({ error: "Active paid subscription cannot be replaced by FREE." });
    return;
  }

  const [updated] = await db
    .update(users)
    .set({ plan: "free", planSelected: true, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId))
    .returning();

  req.log.info(
    { clerkUserId, previousPlan: user.plan, selectedPlan: updated.plan },
    "FREE plan selected",
  );

  res.json({ ok: true, plan: updated.plan, planSelected: updated.planSelected });
});

/* ── POST /auth/send-verification-code ───────────────────────────────────── */
router.post("/auth/send-verification-code", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // invalidate previous unused codes for this user
  await db
    .update(emailVerifications)
    .set({ used: true })
    .where(and(eq(emailVerifications.clerkUserId, clerkUserId), eq(emailVerifications.used, false)));

  // generate 6-digit code
  const code = String(randomInt(100000, 999999));
  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(emailVerifications).values({
    clerkUserId,
    email: user.email,
    codeHash,
    expiresAt,
  });

  await sendOtpEmail(user.email, code);

  req.log.info({ clerkUserId, email: user.email }, "OTP code sent");
  res.json({ ok: true });
});

/* ── POST /auth/verify-code ─────────────────────────────────────────────── */
router.post("/auth/verify-code", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const { code } = req.body as { code?: string };

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code_required" });
    return;
  }

  const inputHash = createHash("sha256").update(code.trim()).digest("hex");

  const [record] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.clerkUserId, clerkUserId),
        eq(emailVerifications.used, false),
      )
    )
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "no_pending_code" });
    return;
  }

  if (record.expiresAt < new Date()) {
    res.status(400).json({ error: "code_expired" });
    return;
  }

  if (record.codeHash !== inputHash) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }

  // mark code as used
  await db
    .update(emailVerifications)
    .set({ used: true })
    .where(eq(emailVerifications.id, record.id));

  // set registrationConfirmed = true
  await db
    .update(users)
    .set({ registrationConfirmed: true, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId));

  req.log.info({ clerkUserId }, "OTP verified — registrationConfirmed=true");
  res.json({ ok: true });
});

/* ── POST /auth/confirm-registration ────────────────────────────────────── */
router.post("/auth/confirm-registration", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(users)
    .set({ registrationConfirmed: true, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId));

  req.log.info({ clerkUserId }, "Registration confirmed directly");
  res.json({ ok: true });
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
