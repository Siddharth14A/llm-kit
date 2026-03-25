import type { LLMUsage } from "../types.js";

export function mergeUsage(...values: Array<LLMUsage | undefined>): LLMUsage | undefined {
  const aggregate: LLMUsage = {};
  let hasValue = false;

  for (const value of values) {
    if (!value) {
      continue;
    }

    hasValue = true;
    if (typeof value.inputTokens === "number") {
      aggregate.inputTokens = (aggregate.inputTokens ?? 0) + value.inputTokens;
    }
    if (typeof value.outputTokens === "number") {
      aggregate.outputTokens = (aggregate.outputTokens ?? 0) + value.outputTokens;
    }
    if (typeof value.totalTokens === "number") {
      aggregate.totalTokens = (aggregate.totalTokens ?? 0) + value.totalTokens;
    }
  }

  return hasValue ? aggregate : undefined;
}
