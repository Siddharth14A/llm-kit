import type { LLMUsage, ProviderChatResult } from "../../types.js";

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  finishReason?: string;
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function joinTextParts(parts: GeminiPart[] | undefined): string {
  return (parts ?? []).map((part) => part.text ?? "").join("");
}

export function mapGeminiChatResponse(raw: GeminiResponse): ProviderChatResult {
  const candidate = raw.candidates?.[0];

  return {
    text: joinTextParts(candidate?.content?.parts),
    finishReason: candidate?.finishReason,
    usage: mapGeminiUsage(raw.usageMetadata),
    raw,
  };
}

export function mapGeminiUsage(
  usage:
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }
    | undefined,
): LLMUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
  };
}

export function extractGeminiStreamDelta(raw: GeminiResponse): {
  text: string;
  finishReason?: string;
  usage?: LLMUsage;
} {
  const candidate = raw.candidates?.[0];
  return {
    text: joinTextParts(candidate?.content?.parts),
    finishReason: candidate?.finishReason,
    usage: mapGeminiUsage(raw.usageMetadata),
  };
}
