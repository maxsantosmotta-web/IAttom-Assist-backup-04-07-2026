import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  AiFindProductsBody,
  AiValidateProductBody,
  AiCreateCampaignBody,
  AiRefineCampaignBlockBody,
  AiCreateContentBody,
  AiCreativeIdeasBody,
  AiVideoScriptBody,
} from "@workspace/api-zod";
import { streamFindProducts } from "../lib/ai/findProducts.js";
import { streamValidateProduct } from "../lib/ai/validateProduct.js";
import { streamCreateCampaign, refineCampaignBlock } from "../lib/ai/createCampaign.js";
import { streamCreateContent } from "../lib/ai/createContent.js";
import { streamCreativeIdeas } from "../lib/ai/creativeIdeas.js";
import { streamVideoScript } from "../lib/ai/videoScript.js";
import { analyzeReference } from "../lib/ai/analyzeReference.js";

const router: IRouter = Router();

router.post("/ai/find-products", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiFindProductsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await streamFindProducts(parsed.data, res, clerkUserId);
});

router.post("/ai/validate-product", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiValidateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await streamValidateProduct(parsed.data, res, clerkUserId);
});

router.post("/ai/create-campaign", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await streamCreateCampaign(parsed.data, res, clerkUserId);
});

router.post("/ai/refine-campaign-block", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiRefineCampaignBlockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { blockId, currentContent, instruction, campaignContext } = parsed.data;
  const result = await refineCampaignBlock(blockId, currentContent, instruction, campaignContext, clerkUserId);
  if ("error" in result) {
    res.status(500).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.post("/ai/create-content", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await streamCreateContent(parsed.data, res, clerkUserId);
});

router.post("/ai/creative-ideas", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreativeIdeasBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await streamCreativeIdeas(parsed.data, res, clerkUserId);
});

router.post("/ai/video-script", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiVideoScriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await streamVideoScript(parsed.data, res, clerkUserId);
});

router.post("/ai/analyze-reference", requireAuth, async (req, res): Promise<void> => {
  const { imageBase64, productName } = req.body as { imageBase64?: unknown; productName?: unknown };
  if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }
  if (typeof productName !== "string" || !productName.trim()) {
    res.status(400).json({ error: "productName is required" });
    return;
  }
  try {
    const result = await analyzeReference(imageBase64, productName);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "analyze-reference failed");
    res.status(500).json({ error: "Falha ao analisar imagem" });
  }
});

export default router;
