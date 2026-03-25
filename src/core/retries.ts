import { ProviderRequestError } from "../errors.js";
import type { RetryConfig } from "../types.js";
import { computeBackoffDelay, delayMs } from "./backoff.js";

export interface RetryContext {
  attempt: number;
  delayMs: number;
}

export interface RetryExecutionOptions extends RetryConfig {
  onRetry?: (context: RetryContext, error: unknown) => void | Promise<void>;
}

function isLikelyTransientError(error: unknown): boolean {
  if (error instanceof ProviderRequestError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    return error.name === "AbortError" || error.name === "TimeoutError" || error.name === "FetchError";
  }

  return false;
}

function isInvalidRequestError(error: unknown): boolean {
  if (error instanceof ProviderRequestError && typeof error.status === "number") {
    return error.status === 400 || error.status === 404 || error.status === 422;
  }

  return false;
}

export function shouldRetryError(error: unknown): boolean {
  if (isInvalidRequestError(error)) {
    return false;
  }

  return isLikelyTransientError(error);
}

export async function executeWithRetries<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryExecutionOptions = {},
): Promise<T> {
  const retries = Math.max(0, Math.floor(options.retries ?? 0));
  const baseDelayMs = Math.max(0, Math.floor(options.retryDelayMs ?? 0));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(options.maxRetryDelayMs ?? baseDelayMs));

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt > retries || !shouldRetryError(error)) {
        throw error;
      }

      const delay = computeBackoffDelay({ attempt, baseDelayMs, maxDelayMs });
      await options.onRetry?.({ attempt, delayMs: delay }, error);
      await delayMs(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry operation failed.");
}
