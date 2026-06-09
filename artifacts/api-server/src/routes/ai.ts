import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
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

router.post("/ai/find-products", requireAuth, async (req, res): Promise<void> => {
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

router.post("/ai/validate-product", requireAuth, async (req, res): Promise<void> => {
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

router.post("/ai/create-campaign", requireAuth, async (req, res): Promise<void> => {
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
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamCreateContent(parsed.data, res, clerkUserId, ac.signal);
});

router.post("/ai/creative-ideas", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = AiCreativeIdeasBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await streamCreativeIdeas(parsed.data, res, clerkUserId, ac.signal);
});

router.post("/ai/video-script", requireAuth, async (req, res): Promise<void> => {
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

router.post("/ai/generate-video", requireAuth, async (req, res): Promise<void> => {
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

router.get("/ai/video-status/:videoId", requireAuth, async (req, res): Promise<void> => {
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
    const statusData = await getVideoStatus(videoId.trim());
    res.json(statusData);
  } catch (err) {
    req.log.error({ err, videoId }, "[video-status] erro ao consultar HeyGen");
    res.status(500).json({ error: "Não foi possível consultar o status do vídeo." });
  }
});

export default router;
