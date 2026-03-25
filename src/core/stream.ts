import type { LLMResponseMeta, LLMStreamChunk, ProviderStreamChunk, ProviderStreamResult, StreamHandle } from "../types.js";

export interface StreamCompletion {
  finishReason?: string;
  usage?: import("../types.js").LLMUsage;
  meta: Pick<LLMResponseMeta, "provider" | "model">;
}

export function normalizeStreamChunk(
  chunk: ProviderStreamChunk,
  meta: Pick<LLMResponseMeta, "provider" | "model">,
): LLMStreamChunk {
  return {
    text: chunk.text ?? "",
    done: chunk.done,
    meta,
  };
}

export function createNormalizedStreamHandle(
  providerStream: ProviderStreamResult,
  meta: Pick<LLMResponseMeta, "provider" | "model">,
): StreamHandle {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of providerStream) {
        yield normalizeStreamChunk(chunk, meta);
      }
    },
    completed: providerStream.completed.then((result): StreamCompletion => ({
      finishReason: result.finishReason,
      usage: result.usage,
      meta,
    })),
  };
}
