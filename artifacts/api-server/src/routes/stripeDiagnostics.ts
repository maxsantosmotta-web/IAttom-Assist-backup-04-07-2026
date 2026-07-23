import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router: IRouter = Router();

router.get(
  "/stripe/diagnostic-session/:sessionId",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    const sessionId = req.params.sessionId?.trim();

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ error: "Invalid Stripe checkout session id" });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["customer"],
      });

      const metadataClerkUserId = session.metadata?.clerkUserId;
      const belongsToAuthenticatedUser =
        session.client_reference_id === clerkUserId ||
        metadataClerkUserId === clerkUserId;

      if (!belongsToAuthenticatedUser) {
        req.log.warn(
          {
            sessionId,
            authenticatedUserId: clerkUserId,
            clientReferenceId: session.client_reference_id,
            metadataClerkUserId,
          },
          "Blocked Stripe diagnostic access to a session owned by another user",
        );
        return res.status(403).json({ error: "Checkout session does not belong to the authenticated user" });
      }

      const customer =
        typeof session.customer === "object" && session.customer && !("deleted" in session.customer)
          ? session.customer
          : null;

      return res.json({
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        paymentStatus: session.payment_status,
        successUrl: session.success_url,
        cancelUrl: session.cancel_url,
        clientReferenceId: session.client_reference_id,
        customerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null,
        customerEmail: customer?.email ?? session.customer_details?.email ?? null,
        metadata: {
          clerkUserId: metadataClerkUserId ?? null,
          planKey: session.metadata?.planKey ?? null,
          type: session.metadata?.type ?? null,
          packId: session.metadata?.packId ?? null,
        },
        createdAt: new Date(session.created * 1000).toISOString(),
        runtime: {
          service: process.env.RAILWAY_SERVICE_NAME ?? "api-server",
          environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? null,
          commitSha:
            process.env.RAILWAY_GIT_COMMIT_SHA ??
            process.env.RAILWAY_GIT_COMMIT ??
            null,
        },
      });
    } catch (error: unknown) {
      req.log.error({ error, sessionId }, "Failed to inspect Stripe checkout session");
      return res.status(500).json({ error: "Failed to inspect Stripe checkout session" });
    }
  },
);

export default router;
