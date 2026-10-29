import { GitHubApiError } from "./errors";

interface QueueItem {
  run: () => void;
  reject: (reason: unknown) => void;
}

/**
 * A small FIFO scheduler. GitHub's anonymous limit is shared and generous enough
 * for exploration, but we still avoid opening many sockets at once.
 */
export class RequestScheduler {
  private queue: QueueItem[] = [];
  private active = 0;

  constructor(private readonly concurrency = 4) {}

  schedule<T>(task: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Request aborted", "AbortError"));
        return;
      }

      const item: QueueItem = {
        run: () => {
          signal?.removeEventListener("abort", onAbort);
          this.active += 1;
          task(signal ?? new AbortController().signal)
            .then(resolve, reject)
            .finally(() => {
              this.active -= 1;
              this.pump();
            });
        },
        reject,
      };

      const onAbort = () => {
        const index = this.queue.indexOf(item);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new DOMException("Request aborted", "AbortError"));
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      this.queue.push(item);
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      next?.run();
    }
  }
}

export class RateLimitGate {
  private blockedUntil: number | null = null;

  blockUntil(timestamp: number | null): void {
    this.blockedUntil = timestamp && timestamp > Date.now() ? timestamp : null;
  }

  clear(): void {
    this.blockedUntil = null;
  }

  assertOpen(): void {
    if (this.blockedUntil && this.blockedUntil > Date.now()) {
      throw new GitHubApiError({
        kind: "rate_limit",
        message: "GitHub's anonymous rate limit is exhausted.",
        status: 403,
        retryAt: this.blockedUntil,
      });
    }
    if (this.blockedUntil && this.blockedUntil <= Date.now()) {
      this.blockedUntil = null;
    }
  }
}

export const githubScheduler = new RequestScheduler(4);
export const rateLimitGate = new RateLimitGate();
