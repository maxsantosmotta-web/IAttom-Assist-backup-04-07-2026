const FAL_ENDPOINT_ID = "fal-ai/veo3.1/lite/image-to-video";
const FAL_SUBMIT_BASE = `https://queue.fal.run/${FAL_ENDPOINT_ID}`;
const FAL_QUEUE_REQUEST_BASE = "https://queue.fal.run/fal-ai/veo3.1";

export type ImageMotionFormat = "vertical" | "horizontal" | "automatic";
export type ImageMotionDuration = "6s";

export interface SubmitImageMotionInput {
  imageDataUrl: string;
  prompt: string;
  format: ImageMotionFormat;
  duration: ImageMotionDuration;
}

export interface FalQueueSubmission { requestId: string; }
export interface FalQueueStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  queuePosition?: number;
  logs?: Array<{ message?: string; timestamp?: string }>;
  error?: string;
}
export interface FalImageMotionResult {
  videoUrl: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
}

type QueueUrls = { statusUrl?: string; responseUrl?: string };
const queueUrlsByRequestId = new Map<string, QueueUrls>();

function getFalKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY_NOT_CONFIGURED");
  return key;
}

function falHeaders(): Record<string, string> {
  return { Authorization: `Key ${getFalKey()}`, "Content-Type": "application/json" };
}

function readProviderMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const value = payload as { detail?: unknown; message?: unknown; error?: unknown };
  if (typeof value.detail === "string" && value.detail.trim()) return value.detail;
  if (typeof value.message === "string" && value.message.trim()) return value.message;
  if (typeof value.error === "string" && value.error.trim()) return value.error;
  if (Array.isArray(value.detail)) {
    const messages = value.detail.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "msg" in item) return String((item as { msg?: unknown }).msg ?? "");
      return "";
    }).filter(Boolean);
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}

async function parseFalResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  }
  if (!response.ok) throw new Error(readProviderMessage(payload, `Fal API error ${response.status}`));
  return payload;
}

function assertRequestId(value: string): void {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(value)) throw new Error("INVALID_FAL_REQUEST_ID");
}

function safeFalQueueUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "queue.fal.run") return undefined;
    return url.toString();
  } catch { return undefined; }
}

function statusUrlFor(requestId: string): string {
  return queueUrlsByRequestId.get(requestId)?.statusUrl ?? `${FAL_QUEUE_REQUEST_BASE}/requests/${requestId}/status?logs=1`;
}
function responseUrlFor(requestId: string): string {
  return queueUrlsByRequestId.get(requestId)?.responseUrl ?? `${FAL_QUEUE_REQUEST_BASE}/requests/${requestId}`;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 30_000);
  return Math.min(5_000 * (attempt + 1), 20_000);
}

async function fetchWithRateLimitRetry(url: string, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method: "GET",
      headers: falHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 429) return response;
    if (attempt === 3) return response;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)));
  }
  throw new Error("Não foi possível consultar o processamento.");
}

export async function submitImageMotion(input: SubmitImageMotionInput): Promise<FalQueueSubmission> {
  const aspectRatio = input.format === "vertical" ? "9:16" : input.format === "horizontal" ? "16:9" : "auto";
  const response = await fetch(FAL_SUBMIT_BASE, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify({
      prompt: input.prompt,
      image_url: input.imageDataUrl,
      aspect_ratio: aspectRatio,
      duration: input.duration,
      resolution: "720p",
      generate_audio: false,
      auto_fix: false,
      safety_tolerance: "4",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await parseFalResponse(response)) as { request_id?: unknown; status_url?: unknown; response_url?: unknown };
  if (typeof payload.request_id !== "string" || !payload.request_id) throw new Error("Fal API did not return a request id");
  queueUrlsByRequestId.set(payload.request_id, {
    statusUrl: safeFalQueueUrl(payload.status_url),
    responseUrl: safeFalQueueUrl(payload.response_url),
  });
  return { requestId: payload.request_id };
}

export async function getImageMotionStatus(requestId: string): Promise<FalQueueStatus> {
  assertRequestId(requestId);
  const response = await fetchWithRateLimitRetry(statusUrlFor(requestId), 15_000);

  // Limite temporário na consulta não significa falha da geração.
  // Mantém o mesmo pedido em processamento para o frontend continuar consultando.
  if (response.status === 429) {
    return { status: "IN_PROGRESS" };
  }

  const payload = (await parseFalResponse(response)) as {
    status?: unknown; queue_position?: unknown; logs?: unknown; error?: unknown; detail?: unknown; message?: unknown;
  };
  const providerError = readProviderMessage(payload, "A geração falhou no provedor.");
  if (payload.status === "FAILED") {
    return {
      status: "FAILED",
      error: providerError,
      logs: Array.isArray(payload.logs) ? payload.logs as Array<{ message?: string; timestamp?: string }> : undefined,
    };
  }
  if (payload.status !== "IN_QUEUE" && payload.status !== "IN_PROGRESS" && payload.status !== "COMPLETED") {
    throw new Error(`Fal API returned an unknown status: ${String(payload.status ?? "empty")}`);
  }
  return {
    status: payload.status,
    queuePosition: typeof payload.queue_position === "number" ? payload.queue_position : undefined,
    logs: Array.isArray(payload.logs) ? payload.logs as Array<{ message?: string; timestamp?: string }> : undefined,
    error: typeof payload.error === "string" ? payload.error : undefined,
  };
}

export async function getImageMotionResult(requestId: string): Promise<FalImageMotionResult> {
  assertRequestId(requestId);
  const response = await fetchWithRateLimitRetry(responseUrlFor(requestId), 30_000);
  if (response.status === 429) throw new Error("O vídeo terminou, mas o arquivo ainda está sendo liberado. Consulte novamente em instantes.");
  const payload = (await parseFalResponse(response)) as {
    video?: { url?: unknown; content_type?: unknown; file_name?: unknown; file_size?: unknown };
  };
  if (typeof payload.video?.url !== "string" || !payload.video.url) throw new Error("Fal API did not return the generated video");
  queueUrlsByRequestId.delete(requestId);
  return {
    videoUrl: payload.video.url,
    contentType: typeof payload.video.content_type === "string" ? payload.video.content_type : undefined,
    fileName: typeof payload.video.file_name === "string" ? payload.video.file_name : undefined,
    fileSize: typeof payload.video.file_size === "number" ? payload.video.file_size : undefined,
  };
}
