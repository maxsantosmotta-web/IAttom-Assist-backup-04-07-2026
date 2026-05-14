import { randomUUID } from "crypto";
import { LoggerManager } from "./LoggerManager.js";
import { NotificationManager } from "./NotificationManager.js";
import type { RetryJob, RetryStatus, IntegrationId, RetryExecutorFn } from "./types.js";

// ─── Exponential backoff delays (ms) ─────────────────────────────────────────

const BACKOFF_DELAYS = [5_000, 15_000, 45_000, 120_000, 300_000]; // 5s, 15s, 45s, 2m, 5m

function backoffDelay(attempt: number): number {
  return BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)];
}

// ─── Retry queue implementation ───────────────────────────────────────────────

class RetryQueueImpl {
  private jobs: Map<string, RetryJob> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private executors: Map<string, RetryExecutorFn> = new Map();

  // ─── Enqueue ────────────────────────────────────────────────────────────

  enqueue(opts: {
    integrationId: IntegrationId;
    operation: string;
    payload: unknown;
    maxAttempts?: number;
    executor: RetryExecutorFn;
  }): RetryJob {
    const id = randomUUID();
    const maxAttempts = opts.maxAttempts ?? 3;

    const job: RetryJob = {
      id,
      integrationId: opts.integrationId,
      operation: opts.operation,
      payload: opts.payload,
      attempts: 0,
      maxAttempts,
      nextRetryAt: new Date(Date.now() + backoffDelay(0)),
      status: "pending",
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    this.executors.set(id, opts.executor);

    LoggerManager.info(
      `RetryQueue: enqueued "${opts.operation}" (max ${maxAttempts} attempts)`,
      opts.integrationId,
      { jobId: id },
    );

    this.scheduleNext(id);
    return job;
  }

  // ─── Schedule next attempt ───────────────────────────────────────────────

  private scheduleNext(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    const delay = job.nextRetryAt.getTime() - Date.now();
    const timer = setTimeout(() => void this.execute(id), Math.max(0, delay));
    this.timers.set(id, timer);
  }

  // ─── Execute with retry logic ────────────────────────────────────────────

  private async execute(id: string): Promise<void> {
    const job = this.jobs.get(id);
    const executor = this.executors.get(id);
    if (!job || !executor) return;

    job.attempts++;
    job.status = "retrying";

    LoggerManager.info(
      `RetryQueue: attempt ${job.attempts}/${job.maxAttempts} for "${job.operation}"`,
      job.integrationId,
      { jobId: id },
    );

    try {
      await executor(job);
      job.status = "success";
      job.resolvedAt = new Date();
      this.timers.delete(id);
      this.executors.delete(id);

      LoggerManager.info(
        `RetryQueue: "${job.operation}" succeeded on attempt ${job.attempts}`,
        job.integrationId,
        { jobId: id },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      job.lastError = errMsg;

      if (job.attempts >= job.maxAttempts) {
        job.status = "exhausted";
        job.resolvedAt = new Date();
        this.timers.delete(id);
        this.executors.delete(id);

        LoggerManager.error(
          `RetryQueue: "${job.operation}" exhausted after ${job.attempts} attempts: ${errMsg}`,
          job.integrationId,
          { jobId: id },
        );

        NotificationManager.retryExhausted(job.integrationId, job.operation);
      } else {
        job.status = "pending";
        job.nextRetryAt = new Date(Date.now() + backoffDelay(job.attempts));

        LoggerManager.warn(
          `RetryQueue: "${job.operation}" failed (attempt ${job.attempts}), retry in ${backoffDelay(job.attempts)}ms`,
          job.integrationId,
          { jobId: id, error: errMsg },
        );

        this.scheduleNext(id);
      }
    }
  }

  // ─── Cancel ─────────────────────────────────────────────────────────────

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);

    this.timers.delete(id);
    this.executors.delete(id);
    this.jobs.delete(id);

    LoggerManager.info(`RetryQueue: cancelled job "${job.operation}"`, job.integrationId, { jobId: id });
    return true;
  }

  cancelAll(integrationId: IntegrationId): number {
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (job.integrationId === integrationId) {
        this.cancel(id);
        count++;
      }
    }
    return count;
  }

  // ─── Query ──────────────────────────────────────────────────────────────

  getJob(id: string): RetryJob | undefined {
    return this.jobs.get(id);
  }

  getJobs(opts?: { integrationId?: IntegrationId; status?: RetryStatus }): RetryJob[] {
    let result = [...this.jobs.values()];

    if (opts?.integrationId) {
      result = result.filter((j) => j.integrationId === opts.integrationId);
    }
    if (opts?.status) {
      result = result.filter((j) => j.status === opts.status);
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  get pendingCount(): number {
    return [...this.jobs.values()].filter((j) => j.status === "pending" || j.status === "retrying").length;
  }

  get exhaustedCount(): number {
    return [...this.jobs.values()].filter((j) => j.status === "exhausted").length;
  }

  // ─── Cleanup resolved jobs older than maxAge ─────────────────────────────

  pruneResolved(maxAgeMs = 3_600_000): number {
    const cutoff = Date.now() - maxAgeMs;
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (
        (job.status === "success" || job.status === "exhausted") &&
        job.resolvedAt &&
        job.resolvedAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const RetryQueue = new RetryQueueImpl();
