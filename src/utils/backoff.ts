export interface BackoffOptions {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

export function computeBackoffDelay(options: BackoffOptions): number {
  const { attempt, baseDelayMs, maxDelayMs = 5_000 } = options;
  const exponent = Math.max(0, attempt - 1);
  const delay = baseDelayMs * 2 ** exponent;
  return Math.min(delay, maxDelayMs);
}
