const FAL_ENDPOINT_ID = "fal-ai/veo3.1/lite/image-to-video";
const FAL_QUEUE_BASE = `https://queue.fal.run/${FAL_ENDPOINT_ID}`;

export type ImageMotionFormat = "feed" | "story";
export type ImageMotionDuration = "6s";

export interface SubmitImageMotionInput {
  imageDataUrl: string;
  prompt: string;
  format: ImageMotionFormat;
  duration: ImageMotionDuration;
}

export interface FalQueueSubmission {
  requestId: string;
}

export interface FalQueueStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
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

function getFalKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY_NOT_CONFIGURED");
  return key;
}

function falHeaders(): Record<string, string> {
  return {
    Authorization: `Key ${getFalKey()}`,
    "Content-Type": "application/json",
  };
}

async function parseFalResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message?: unknown }).message)
          : `Fal API error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function assertRequestId(value: string): void {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(value)) {
    throw new Error("INVALID_FAL_REQUEST_ID");
  }
}

export async function submitImageMotion(input: SubmitImageMotionInput): Promise<FalQueueSubmission> {
  const aspectRatio = input.format === "story" ? "9:16" : "auto";

  const response = await fetch(FAL_QUEUE_BASE, {
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

  const payload = (await parseFalResponse(response)) as { request_id?: unknown };
  if (typeof payload.request_id !== "string" || !payload.request_id) {
    throw new Error("Fal API did not return a request id");
  }

  return { requestId: payload.request_id };
}

export async function getImageMotionStatus(requestId: string): Promise<FalQueueStatus> {
  assertRequestId(requestId);
  const response = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}/status?logs=1`, {
    headers: falHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await parseFalResponse(response)) as {
    status?: unknown;
    queue_position?: unknown;
    logs?: unknown;
    error?: unknown;
  };

  if (payload.status !== "IN_QUEUE" && payload.status !== "IN_PROGRESS" && payload.status !== "COMPLETED") {
    throw new Error("Fal API returned an unknown status");
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
  const response = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}/response`, {
    headers: falHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await parseFalResponse(response)) as {
    video?: {
      url?: unknown;
      content_type?: unknown;
      file_name?: unknown;
      file_size?: unknown;
    };
  };

  if (typeof payload.video?.url !== "string" || !payload.video.url) {
    throw new Error("Fal API did not return the generated video");
  }

  return {
    videoUrl: payload.video.url,
    contentType: typeof payload.video.content_type === "string" ? payload.video.content_type : undefined,
    fileName: typeof payload.video.file_name === "string" ? payload.video.file_name : undefined,
    fileSize: typeof payload.video.file_size === "number" ? payload.video.file_size : undefined,
  };
}
