import type { LLMUsage, ProviderChatResult } from "../../types.js";

interface OllamaMessage {
  content?: string;
}

interface OllamaResponse {
  message?: OllamaMessage;
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export function mapOllamaChatResponse(raw: OllamaResponse): ProviderChatResult {
  return {
    text: raw.message?.content ?? "",
    finishReason: raw.done_reason,
    usage: mapOllamaUsage(raw),
    raw,
  };
}

export function mapOllamaUsage(raw: OllamaResponse): LLMUsage | undefined {
  const inputTokens = raw.prompt_eval_count;
  const outputTokens = raw.eval_count;

  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens:
      typeof inputTokens === "number" && typeof outputTokens === "number" ? inputTokens + outputTokens : undefined,
  };
}

export function extractOllamaStreamDelta(raw: OllamaResponse): {
  text: string;
  finishReason?: string;
  usage?: LLMUsage;
  done?: boolean;
} {
  return {
    text: raw.message?.content ?? "",
    finishReason: raw.done_reason,
    usage: mapOllamaUsage(raw),
    done: raw.done,
  };
}
