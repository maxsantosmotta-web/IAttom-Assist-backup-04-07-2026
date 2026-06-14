import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware.js";
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

app.use("/api", router);

// ─── Start global integration monitors ───────────────────────────────────────
IntegrationManager.startHealthMonitor();
TokenManager.startExpiryMonitor();
logger.info("Integration monitors started");

export default app;
