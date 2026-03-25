export interface BackoffOptions {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export function computeBackoffDelay({ attempt, baseDelayMs, maxDelayMs }: BackoffOptions): number {
  const exponential = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(maxDelayMs, exponential);
  const jitter = capped * 0.2 * Math.random();
  return Math.max(0, Math.round(capped + jitter));
}

export function delayMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
