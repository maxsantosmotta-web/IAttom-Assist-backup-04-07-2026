import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { setupSSE, sendSSE, sendSSEDone } from "../lib/ai/stream.js";

const router: IRouter = Router();

router.post("/help/chat", requireAuth, async (_req, res): Promise<void> => {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const reply =
    "IAttom Help configurado com sucesso. A base de conhecimento oficial será adicionada nas próximas etapas.";

  const words = reply.split(" ");
  for (const word of words) {
    sendSSE(res, { type: "chunk", content: word + " " });
    await new Promise<void>((r) => setTimeout(r, 35));
  }

  sendSSE(res, { type: "result", data: { text: reply } });
  sendSSEDone(res);
});

export default router;
