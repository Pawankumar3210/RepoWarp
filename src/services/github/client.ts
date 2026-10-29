import type { RateLimitState } from "../../types/domain";
import { BoundedCache } from "../cache/boundedCache";
import { GitHubApiError, isAbortError } from "./errors";
import { githubScheduler, rateLimitGate } from "./scheduler";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";

const responseCache = new BoundedCache<unknown>(140, 5 * 60 * 1000);

interface InFlightEntry {
  promise: Promise<unknown>;
  controller: AbortController;
  consumers: number;
}

const inFlight = new Map<string, InFlightEntry>();
let lastRateLimit: RateLimitState = {
  limit: null,
  remaining: null,
  resetAt: null,
  blockedUntil: null,
  lastUpdated: null,
};
let rateLimitObserver: ((state: RateLimitState) => void) | null = null;

export interface RequestOptions {
  signal?: AbortSignal;
  ttlMs?: number;
}

function notifyRateLimit(): void {
  rateLimitObserver?.({ ...lastRateLimit });
}

export function setRateLimitObserver(
  observer: ((state: RateLimitState) => void) | null,
): void {
  rateLimitObserver = observer;
  if (observer) observer({ ...lastRateLimit });
}

export function getRateLimitState(): RateLimitState {
  return { ...lastRateLimit };
}

function readNumberHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function updateRateLimitFromResponse(headers: Headers, status: number): void {
  const limit = readNumberHeader(headers, "x-ratelimit-limit");
  const remaining = readNumberHeader(headers, "x-ratelimit-remaining");
  const resetSeconds = readNumberHeader(headers, "x-ratelimit-reset");
  const retryAfterSeconds = readNumberHeader(headers, "retry-after");
  const resetAt = resetSeconds ? resetSeconds * 1000 : null;
  const now = Date.now();
  const retryAt = retryAfterSeconds ? now + retryAfterSeconds * 1000 : null;

  let blockedUntil = lastRateLimit.blockedUntil;
  if (remaining !== null && remaining > 0) {
    blockedUntil = null;
    rateLimitGate.clear();
  }

  if ((status === 403 || status === 429) && (remaining === 0 || retryAfterSeconds)) {
    blockedUntil = retryAt ?? resetAt;
    if (blockedUntil && blockedUntil > now) {
      rateLimitGate.blockUntil(blockedUntil);
    }
  }

  lastRateLimit = {
    limit,
    remaining,
    resetAt,
    blockedUntil,
    lastUpdated: now,
  };
  notifyRateLimit();
}

function makeAbortError(): DOMException {
  return new DOMException("Request aborted", "AbortError");
}

function attachConsumerSignal<T>(
  entry: InFlightEntry,
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) return promise;

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      entry.consumers -= 1;
      if (entry.consumers <= 0) {
        entry.controller.abort();
      }
      reject(makeAbortError());
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

async function performRequest<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  rateLimitGate.assertOpen();

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
      },
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new GitHubApiError({
        kind: "aborted",
        message: "The GitHub request was cancelled.",
        requestPath: path,
      });
    }
    throw new GitHubApiError({
      kind: "network",
      message:
        "RepoWarp could not reach the GitHub API. Check your connection and try again.",
      requestPath: path,
    });
  }

  updateRateLimitFromResponse(response.headers, response.status);

  const rawText = await response.text().catch(() => "");
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      if (response.ok) {
        throw new GitHubApiError({
          kind: "malformed",
          message: "GitHub returned a response RepoWarp could not read.",
          status: response.status,
          requestPath: path,
        });
      }
    }
  }

  if (!response.ok) {
    const body = (typeof data === "object" && data !== null ? data : {}) as {
      message?: string;
      documentation_url?: string;
    };
    const bodyMessage = body.message ?? "";
    const docsUrl = body.documentation_url;
    const rateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")));
    const retryAt = lastRateLimit.blockedUntil ?? lastRateLimit.resetAt;

    if (rateLimited) {
      throw new GitHubApiError({
        kind: "rate_limit",
        message:
          "GitHub's anonymous API rate limit has been reached. No credentials are required, but limits are shared per IP address.",
        status: response.status,
        retryAt,
        docsUrl,
        requestPath: path,
      });
    }

    if (response.status === 404) {
      throw new GitHubApiError({
        kind: "not_found",
        message: "GitHub could not find that public resource.",
        status: 404,
        docsUrl,
        requestPath: path,
      });
    }

    if (response.status === 409 && /empty/i.test(bodyMessage)) {
      throw new GitHubApiError({
        kind: "empty_repo",
        message: "This repository has no commits yet.",
        status: 409,
        docsUrl,
        requestPath: path,
      });
    }

    if (response.status === 403) {
      throw new GitHubApiError({
        kind: "forbidden",
        message:
          bodyMessage ||
          "GitHub refused the request. The repository may be private or access may be restricted.",
        status: 403,
        docsUrl,
        requestPath: path,
      });
    }

    if (response.status === 451) {
      throw new GitHubApiError({
        kind: "forbidden",
        message: "GitHub reports that this repository is unavailable for legal reasons.",
        status: 451,
        docsUrl,
        requestPath: path,
      });
    }

    throw new GitHubApiError({
      kind: response.status >= 500 ? "api" : "unsupported",
      message:
        bodyMessage ||
        (response.status >= 500
          ? "GitHub's API is having trouble right now. Try again in a moment."
          : "GitHub could not complete this request."),
      status: response.status,
      docsUrl,
      requestPath: path,
    });
  }

  if (data === null) {
    throw new GitHubApiError({
      kind: "malformed",
      message: "GitHub returned an empty response.",
      status: response.status,
      requestPath: path,
    });
  }

  return data as T;
}

export async function requestGitHub<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const cached = responseCache.get(path);
  if (cached.hit) {
    return cached.value as T;
  }

  rateLimitGate.assertOpen();

  const existing = inFlight.get(path);
  if (existing && !existing.controller.signal.aborted) {
    existing.consumers += 1;
    return attachConsumerSignal(existing, existing.promise as Promise<T>, options.signal);
  }
  if (existing) {
    inFlight.delete(path);
  }

  const controller = new AbortController();
  const entry: InFlightEntry = {
    promise: Promise.resolve(),
    controller,
    consumers: 1,
  };

  const ttl = options.ttlMs ?? 5 * 60 * 1000;
  const run = githubScheduler
    .schedule((signal) => performRequest<T>(path, signal), controller.signal)
    .then((data) => {
      responseCache.set(path, data, ttl);
      return data;
    })
    .finally(() => {
      inFlight.delete(path);
    });

  entry.promise = run;
  inFlight.set(path, entry);

  return attachConsumerSignal(entry, run, options.signal);
}

export function parseNextPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const nextPart = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel="next"/.test(part));
  if (!nextPart) return null;
  const match = /[?&]page=(\d+)/.exec(nextPart);
  if (!match?.[1]) return null;
  const page = Number(match[1]);
  return Number.isFinite(page) ? page : null;
}

export function clearGitHubMemoryCache(): void {
  responseCache.clear();
  inFlight.clear();
  lastRateLimit = {
    limit: null,
    remaining: null,
    resetAt: null,
    blockedUntil: null,
    lastUpdated: null,
  };
  rateLimitGate.clear();
}

export function getGithubCacheSize(): number {
  return responseCache.size;
}
