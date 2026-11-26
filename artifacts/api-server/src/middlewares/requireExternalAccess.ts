import type { Request, Response, NextFunction } from "express";
import { requireChatGPTAuth } from "./requireChatGPTAuth.js";

// Explicitly mounted only on future external operation routes.
// Existing website authentication is intentionally unchanged.
// Disabled by default, including on deployments without explicit configuration.
export async function requireExternalAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.CHATGPT_OPERATIONS_ENABLED !== "true") {
    res.status(503).json({ error: "external_operations_disabled" });
    return;
  }
  await requireChatGPTAuth(req, res, next);
}
