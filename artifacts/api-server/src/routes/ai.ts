import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import {
  AiFindProductsBody,
  AiValidateProductBody,
  AiCreateCampaignBody,
  AiRefineCampaignBlockBody,
  AiCreateContentBody,
  AiCreativeIdeasBody,
  AiVideoScriptBody,
  AiGenerateVideoBody,
} from "@workspace/api-zod";
import { streamFindProducts } from "../lib/ai/findProducts.js";
import { streamValidateProduct } from "../lib/ai/validateProduct.js";
import { streamCreateCampaign, refineCampaignBlock } from "../lib/ai/createCampaign.js";
import { streamCreateContent } from "../lib/ai/createContent.js";
import { streamCreativeIdeas } from "../lib/ai/creativeIdeas.js";
import { streamVideoScript } from "../lib/ai/videoScript.js";
import { streamVideoGeneration } from "../lib/ai/videoGeneration.js";
import { getVideoStatus, HEYGEN_CONFIGURED } from "../lib/heygenClient.js";
import { analyzeReference } from "../lib/ai/analyzeReference.js";

const router: IRouter = Router();

const MAX_CREATIVE_PROMPT_LENGTH = 1800;
const CREATIVE_PROMPT_END_LENGTH = 350;

function compactCreativePrompt(prompt: string): string {
  const normalized = prompt
    .replace(/```[a-z]*\s*/gi, "")
    .replace(/```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length <= MAX_CREATIVE_PROMPT_LENGTH) return normalized;

  const endLength = Math.min(CREATIVE_PROMPT_END_LENGTH, normalized.length);
  const startLength = MAX_CREATIVE_PROMPT_LENGTH - endLength - 5;
  const start = normalized.slice(0, startLength).trimEnd();
  const end = normalized.slice(-endLength).trimStart();

  return `${start}\n...\n${end}`;
}

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Muitas requisições. Aguarde um momento antes de tentar novamente." });
  },
});

router.use(aiRateLimiter);

// PRO only
router.post("/ai/find-products", requireAuth, requirePlan(["agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiFindProductsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamFindProducts(parsed.data, res, clerkUserId, ac.signal);
});

// PREMIUM + PRO
router.post("/ai/validate-product", requireAuth, requirePlan(["business", "agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiValidateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamValidateProduct(parsed.data, res, clerkUserId, ac.signal);
});

// START + PREMIUM + PRO
router.post("/ai/create-campaign", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamCreateCampaign(parsed.data, res, clerkUserId, ac.signal);
});

// START + PREMIUM + PRO
router.post("/ai/refine-campaign-block", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
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

// PRO only
router.post("/ai/create-content", requireAuth, requirePlan(["agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamCreateContent(parsed.data, res, clerkUserId, ac.signal);
});

// START + PREMIUM + PRO
router.post("/ai/creative-ideas", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreativeIdeasBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamCreativeIdeas(
    { ...parsed.data, prompt: compactCreativePrompt(parsed.data.prompt) },
    res,
    clerkUserId,
    ac.signal,
  );
});

// PREMIUM + PRO
router.post("/ai/video-script", requireAuth, requirePlan(["business", "agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiVideoScriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamVideoScript(parsed.data, res, clerkUserId, ac.signal);
});

// START + PREMIUM + PRO
router.post("/ai/generate-video", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiGenerateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.videoDuration > 30) {
    res.status(400).json({ error: "Seu roteiro excede o limite máximo de 30 segundos. Reduza o texto e tente novamente." });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamVideoGeneration(parsed.data, res, clerkUserId, ac.signal);
});

// START + PREMIUM + PRO (part of creative flow)
router.post("/ai/analyze-reference", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
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

// START + PREMIUM + PRO
router.get("/ai/video-status/:videoId", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
  const videoId = req.params["videoId"] as string;
  if (!videoId || !videoId.trim()) {
    res.status(400).json({ error: "video_id inválido" });
    return;
  }
  if (!HEYGEN_CONFIGURED) {
    res.json({ status: "pending", videoUrl: null, error: null });
    return;
  }
  try {
    const status = await getVideoStatus(videoId);
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "video-status failed");
    res.status(500).json({ error: "Falha ao verificar status do vídeo" });
  }
});

export default router;
