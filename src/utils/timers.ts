export function now(): number {
  return Date.now();
}

export function elapsedMs(startTime: number): number {
  return Math.max(0, Date.now() - startTime);
}
