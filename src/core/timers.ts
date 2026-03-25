export interface TimerSnapshot {
  readonly startedAt: number;
  elapsed(): number;
}

export function nowMs(): number {
  return Date.now();
}

export function createTimer(clock: () => number = nowMs): TimerSnapshot {
  const startedAt = clock();
  return {
    startedAt,
    elapsed() {
      return Math.max(0, clock() - startedAt);
    },
  };
}
