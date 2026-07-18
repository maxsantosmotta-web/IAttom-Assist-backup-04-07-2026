import express, { type Express } from "express";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkClient, clerkMiddleware } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware.js";
import { requireAdmin } from "./middlewares/requireAdmin.js";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { WebhookHandlers } from "./lib/webhookHandlers.js";
import { IntegrationManager, TokenManager } from "./lib/integrations/index.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Stripe webhook MUST be registered BEFORE express.json()
// It needs the raw Buffer body for signature verification
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      req.log.error(
        "Stripe webhook: req.body is not a Buffer — express.json() ran first",
      );
      res.status(500).json({ error: "Webhook body parsing error" });
      return;
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      req.log.error({ err }, "Stripe webhook processing error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY?.trim().replace(/\.+$/, "");
if (!clerkPubKey) {
  logger.error("CLERK_PUBLISHABLE_KEY is not set — Clerk middleware will fail. Set this env var before starting the server.");
  process.exit(1);
}

app.use(
  clerkMiddleware({
    publishableKey: clerkPubKey,
  }),
);

// Dedicated production endpoint. A unique path prevents the legacy generated
// DELETE /api/admin/users/:id route from intercepting this request.
app.delete("/api/admin/users/:id/remove-v2", requireAdmin, async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID de usuário inválido", source: "direct-admin-delete-v2" });
    return;
  }

  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) {
    res.status(404).json({ error: "Usuário não encontrado", source: "direct-admin-delete-v2" });
    return;
  }

  if (targetUser.email.trim().toLowerCase() === "maxsantosmotta@gmail.com") {
    res.status(403).json({
      error: "A conta principal do administrador não pode ser excluída.",
      source: "direct-admin-delete-v2",
    });
    return;
  }

  try {
    try {
      await clerkClient.users.deleteUser(targetUser.clerkId);
    } catch (clerkError: unknown) {
      req.log.warn(
        { err: clerkError, clerkId: targetUser.clerkId },
        "Direct admin delete v2: Clerk removal failed; continuing anonymization",
      );
    }

    const anonymousEmail = `deleted_${targetUser.id}_${Date.now()}@deleted.iattom.invalid`;
    const [updated] = await db
      .update(users)
      .set({
        email: anonymousEmail,
        name: "Usuário excluído",
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUser.id))
      .returning({ id: users.id });

    if (!updated) {
      res.status(500).json({
        error: "O banco não confirmou a anonimização do usuário.",
        source: "direct-admin-delete-v2",
      });
      return;
    }

    res.json({
      ok: true,
      deletedEmail: targetUser.email,
      cleanupMode: "anonymized",
      source: "direct-admin-delete-v2",
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error(
      { err, userId: id, clerkId: targetUser.clerkId },
      "Direct admin delete v2 failed",
    );
    res.status(500).json({
      error: `Falha v2 ao remover usuário: ${detail}`,
      source: "direct-admin-delete-v2",
    });
  }
});

app.use("/api", router);

// Railway runs this API server as the single production process. Serve the
// already-built React application from the same origin so authenticated API
// requests, Clerk proxy requests and the dashboard use one stable domain.
const frontendDist = path.resolve(process.cwd(), "artifacts/iattom-assist/dist/public");
app.use(express.static(frontendDist, { index: false, fallthrough: true }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "API route not found" });
    return;
  }

  if (req.method === "GET" && req.accepts("html")) {
    res.sendFile(path.join(frontendDist, "index.html"), (error) => {
      if (error) next(error);
    });
    return;
  }

  next();
});

// ─── Start global integration monitors ───────────────────────────────────────
IntegrationManager.startHealthMonitor();
TokenManager.startExpiryMonitor();
logger.info("Integration monitors started");

export default app;
