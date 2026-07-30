import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/routes/help.ts", import.meta.url);
let source = readFileSync(helpUrl, "utf8");

const oldAbort = `  // Abort signal — terminates the OpenAI stream when the client disconnects
  const ac = new AbortController();
  req.on("close", () => ac.abort());`;

const newAbort = `  // Abort only when the SSE response is actually closed before completion.
  // req.close can fire after the request body is consumed and was aborting valid first messages.
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) ac.abort();
  });`;

if (!source.includes(newAbort)) {
  if (!source.includes(oldAbort)) {
    throw new Error("IAttom Help abort lifecycle marker was not found");
  }
  source = source.replace(oldAbort, newAbort);
}

const clearRoute = `router.delete("/help/history", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  try {
    await db.delete(helpMessages).where(eq(helpMessages.clerkUserId, userId));
    res.json({ ok: true });
  } catch {
    req.log.error({ msg: "Error clearing help history", userId });
    res.status(500).json({ error: "Erro ao limpar histórico." });
  }
});`;

if (!source.includes(clearRoute)) {
  throw new Error("IAttom Help clear-history route changed unexpectedly");
}

if (clearRoute.includes("helpMessagesUsed")) {
  throw new Error("Clearing IAttom Help history must never reset usage");
}

writeFileSync(helpUrl, source);
console.log("IAttom Help stream lifecycle stabilized; history deletion remains independent from usage.");
