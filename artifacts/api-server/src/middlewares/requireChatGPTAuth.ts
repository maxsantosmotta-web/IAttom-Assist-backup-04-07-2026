import { clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

/** Only for the isolated ChatGPT routes; regular web sessions keep their existing middleware. */
export async function requireChatGPTAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const resourceUrl = process.env.CHATGPT_MCP_RESOURCE_URL;
  if (!resourceUrl) {
    res.status(503).json({ error: "ChatGPT integration not configured" });
    return;
  }

  const authorization = req.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization)) {
    res.status(401).json({ error: "OAuth token required" });
    return;
  }

  try {
    const state = await clerkClient.authenticateRequest(
      new Request(resourceUrl, { headers: { authorization } }),
      { acceptsToken: "oauth_token", audience: resourceUrl },
    );
    if (!state.isAuthenticated) {
      res.status(401).json({ error: "Invalid OAuth token" });
      return;
    }
    const auth = state.toAuth();
    if (!auth.userId || !auth.scopes?.includes("profile")) {
      res.status(403).json({ error: "Profile scope required" });
      return;
    }
    (req as Request & { clerkUserId: string }).clerkUserId = auth.userId;
    next();
  } catch (error) {
    req.log.error({ error }, "ChatGPT OAuth verification failed");
    res.status(503).json({ error: "OAuth verification unavailable" });
  }
}
