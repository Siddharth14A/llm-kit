import type { LLMUsage, ProviderChatResult } from "../../types.js";

interface OpenAIMessage {
  content?: string | null;
}

interface OpenAIChoice {
  finish_reason?: string | null;
  message?: OpenAIMessage;
  delta?: OpenAIMessage;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export function mapOpenAIChatResponse(raw: OpenAIResponse): ProviderChatResult {
  const choice = raw.choices?.[0];
  const text = choice?.message?.content ?? "";

  return {
    text,
    finishReason: choice?.finish_reason ?? undefined,
    usage: mapOpenAIUsage(raw.usage),
    raw,
  };
}

export function mapOpenAIUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | undefined,
): LLMUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

export function extractOpenAIStreamDelta(raw: OpenAIResponse): {
  text: string;
  finishReason?: string;
  usage?: LLMUsage;
} {
  const choice = raw.choices?.[0];
  return {
    text: choice?.delta?.content ?? choice?.message?.content ?? "",
    finishReason: choice?.finish_reason ?? undefined,
    usage: mapOpenAIUsage(raw.usage),
  };
}
