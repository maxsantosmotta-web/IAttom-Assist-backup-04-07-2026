import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { creditsTransactions, db, savedItemsTable, users } from "@workspace/db";
import { requireExternalAccess } from "../middlewares/requireExternalAccess.js";
import { isolatedExternalWritesEnabled } from "../lib/chatgpt/isolation.js";
import { FEATURE_COSTS } from "../lib/credits.js";
import { invokeExistingHelpForChatGPT } from "./help.js";

const router: IRouter = Router();
const PAID = new Set(["pro", "business", "agency"]);
const REQUEST_ID = /^[A-Za-z0-9_-]{16,72}$/;

// Unlike the website, the external adapter owns debit and idempotent saving.
// The canonical Help generator is reused, but its own debit is skipped only
// for the server-created internal invocation. No public refund endpoint.
router.post("/chatgpt/help/execute", requireExternalAccess, async (req, res): Promise<void> => {
  if (!isolatedExternalWritesEnabled()) {
    res.status(503).json({ error: "isolated_external_writes_disabled" }); return;
  }
  const body = req.body as { message?: unknown; requestId?: unknown } | undefined;
  if (typeof body?.requestId !== "string" || !REQUEST_ID.test(body.requestId) ||
      typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000) {
    res.status(400).json({ error: "invalid_help_request" }); return;
  }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const message = body.message.trim();
  const key = "chatgpt-help-" + createHash("sha256").update(userId).update(":").update(body.requestId).digest("hex");
  const inputHash = createHash("sha256").update(message).digest("hex");
  const cost = (FEATURE_COSTS as Record<string, number>).iattom_help;
  if (!Number.isSafeInteger(cost) || cost <= 0) {
    res.status(503).json({ error: "help_policy_unavailable" }); return;
  }

  try {
    const [previous] = await db.select({ data: savedItemsTable.data, content: savedItemsTable.content })
      .from(savedItemsTable).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
    if (previous) {
      const state = previous.data ? JSON.parse(previous.data) as { status?: string; inputHash?: string } : {};
      if (state.inputHash !== inputHash) { res.status(409).json({ error: "operation_conflict" }); return; }
      if (state.status !== "complete") {
        res.status(409).json({ error: "operation_already_reserved", status: state.status ?? "unknown" }); return;
      }
      res.json({ status: "complete", projectId: key, result: JSON.parse(previous.content), chargedAgain: false });
      return;
    }

    const [user] = await db.select({
      role: users.role, plan: users.plan, credits: users.credits, extraCredits: users.extraCredits,
    }).from(users).where(eq(users.clerkId, userId));
    if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
    if (user.role !== "admin" && !PAID.has(user.plan)) {
      res.status(403).json({ error: "plan_required" }); return;
    }
    if (user.credits + (user.extraCredits ?? 0) < cost) {
      res.status(402).json({ error: "insufficient_general_credits", required: cost }); return;
    }

    const [reserved] = await db.insert(savedItemsTable).values({
      id: key, clerkUserId: userId, title: "IAttom Help",
      type: "external_help_pending", content: "",
      data: JSON.stringify({ status: "pending", feature: "iattom_help", inputHash }),
    }).onConflictDoNothing().returning({ id: savedItemsTable.id });
    if (!reserved) { res.status(409).json({ error: "operation_already_reserved" }); return; }

    let answer: string;
    try {
      answer = await invokeExistingHelpForChatGPT(userId, message);
    } catch (error) {
      await db.update(savedItemsTable).set({
        type: "external_help_failed",
        data: JSON.stringify({ status: "failed", feature: "iattom_help", inputHash }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      req.log.warn({ error }, "Isolated IAttom Help failed without charging");
      res.status(502).json({ error: "help_generation_failed_no_charge" }); return;
    }

    const payment = await db.transaction(async tx => {
      const locked = await tx.execute(sql`SELECT credits, extra_credits, plan, role FROM users WHERE clerk_id = ${userId} FOR UPDATE`);
      const row = locked.rows[0] as {
        credits?: unknown; extra_credits?: unknown; plan?: unknown; role?: unknown;
      } | undefined;
      if (!row) return { error: "user_not_found" as const };
      if (row.role !== "admin" && !PAID.has(String(row.plan))) return { error: "plan_required" as const };
      const plan = Number(row.credits ?? 0);
      const extra = Number(row.extra_credits ?? 0);
      const balance = plan + extra;
      if (balance < cost) return { error: "insufficient_general_credits" as const };
      const fromPlan = Math.min(plan, cost);
      const [saved] = await tx.update(savedItemsTable).set({
        type: "help",
        content: JSON.stringify({ answer }),
        data: JSON.stringify({ status: "complete", feature: "iattom_help", inputHash, source: "chatgpt" }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId),
        eq(savedItemsTable.type, "external_help_pending"))).returning({ id: savedItemsTable.id });
      if (!saved) throw new Error("Help reservation lost before charge");
      await tx.update(users).set({
        credits: plan - fromPlan,
        extraCredits: extra - (cost - fromPlan),
        helpMessagesUsed: sql`${users.helpMessagesUsed} + 1`,
        updatedAt: new Date(),
      }).where(eq(users.clerkId, userId));
      await tx.insert(creditsTransactions).values({
        clerkUserId: userId, amount: -cost, type: "debit", feature: "iattom_help",
        balanceType: "general", description: "Uso do IAttom Help",
        balanceBefore: balance, balanceAfter: balance - cost,
      });
      return { projectId: saved.id, charged: cost, balance: balance - cost };
    });
    if ("error" in payment) {
      await db.update(savedItemsTable).set({
        type: "external_help_failed",
        data: JSON.stringify({ status: "failed", feature: "iattom_help", inputHash, reason: payment.error }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      res.status(payment.error === "insufficient_general_credits" ? 402 :
        payment.error === "plan_required" ? 403 : 404).json({ error: payment.error, charged: 0 });
      return;
    }
    res.json({ status: "complete", result: { answer }, ...payment });
  } catch (error) {
    req.log.error({ error }, "External IAttom Help transaction failed");
    res.status(500).json({ error: "external_help_failed" });
  }
});

export default router;
