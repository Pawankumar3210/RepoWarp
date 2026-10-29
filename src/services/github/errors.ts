import type { ApiErrorKind, AppError, RateLimitState } from "../../types/domain";
import { formatDateTime } from "../../utils/format";

export class GitHubApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly retryAt: number | null;
  readonly docsUrl?: string;
  readonly requestPath?: string;

  constructor(options: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
    retryAt?: number | null;
    docsUrl?: string;
    requestPath?: string;
  }) {
    super(options.message);
    this.name = "GitHubApiError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.retryAt = options.retryAt ?? null;
    this.docsUrl = options.docsUrl;
    this.requestPath = options.requestPath;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof GitHubApiError && error.kind === "aborted") ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function isRateLimitError(error: unknown): error is GitHubApiError {
  return error instanceof GitHubApiError && error.kind === "rate_limit";
}

const BASE_TITLES: Record<ApiErrorKind, string> = {
  invalid_url: "Invalid repository URL",
  not_found: "Repository unavailable",
  forbidden: "Access blocked",
  rate_limit: "GitHub rate limit reached",
  network: "Network request failed",
  api: "GitHub API error",
  malformed: "Unexpected response",
  truncated: "Incomplete data",
  unsupported: "Operation unavailable",
  aborted: "Request cancelled",
  empty_repo: "Repository is empty",
  unknown: "Something went wrong",
};

export function toAppError(error: unknown, context?: string): AppError {
  if (error instanceof GitHubApiError) {
    let message = error.message;
    if (error.kind === "rate_limit" && error.retryAt) {
      message = `${message} Try again after ${formatDateTime(new Date(error.retryAt).toISOString())}.`;
    }
    return {
      kind: error.kind,
      title: BASE_TITLES[error.kind],
      message,
      status: error.status ?? undefined,
      retryAt: error.retryAt ?? undefined,
      docsUrl: error.docsUrl,
      requestPath: error.requestPath,
    };
  }

  if (isAbortError(error)) {
    return {
      kind: "aborted",
      title: BASE_TITLES.aborted,
      message: "The request was cancelled.",
    };
  }

  const message =
    error instanceof Error && error.message
      ? error.message
      : "An unexpected error occurred while contacting GitHub.";

  return {
    kind: "unknown",
    title: BASE_TITLES.unknown,
    message: context ? `${context} ${message}` : message,
  };
}

export function friendlyErrorTitle(kind: ApiErrorKind): string {
  return BASE_TITLES[kind];
}

export function describeRateLimit(state: RateLimitState): string | null {
  if (state.remaining === null) return null;
  if (state.remaining > 5) return null;
  if (state.remaining === 0 && state.resetAt) {
    return `The anonymous GitHub API limit is exhausted. Requests can resume after ${formatDateTime(new Date(state.resetAt).toISOString())}.`;
  }
  return `Only ${state.remaining} anonymous GitHub API requests remain in this window.`;
}
