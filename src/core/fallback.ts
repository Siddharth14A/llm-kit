import { LLMFallbackExhaustedError, ProviderRequestError } from "../errors.js";
import type { ProviderType } from "../types.js";
import type { ResolvedProviderConfig } from "./config.js";
import { shouldRetryError } from "./retries.js";

export interface ProviderAttempt {
  config: ResolvedProviderConfig;
  index: number;
  fallbackUsed: boolean;
}

export function buildProviderSequence(primary: ResolvedProviderConfig, fallback: ResolvedProviderConfig[]): ProviderAttempt[] {
  const sequence = [primary, ...fallback];
  return sequence.map((config, index) => ({
    config,
    index,
    fallbackUsed: index > 0,
  }));
}

export function shouldFallbackOnError(error: unknown): boolean {
  if (!shouldRetryError(error)) {
    return error instanceof ProviderRequestError ? error.status !== 400 && error.status !== 422 : true;
  }

  return true;
}

export async function executeWithFallback<T>(
  attempts: ProviderAttempt[],
  operation: (attempt: ProviderAttempt) => Promise<T>,
): Promise<{ result: T; attempt: ProviderAttempt }> {
  const errors: Error[] = [];

  for (const attempt of attempts) {
    try {
      const result = await operation(attempt);
      return { result, attempt };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      errors.push(normalizedError);
      if (!shouldFallbackOnError(error)) {
        throw error;
      }
    }
  }

  throw new LLMFallbackExhaustedError("All configured provider attempts failed.", errors);
}

export function providerLabel(provider: ProviderType, model: string): string {
  return `${provider}:${model}`;
}
