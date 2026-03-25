import type { BaseProviderConfig, LLMMessage, ProviderRequest } from "../../types.js";
import type { ProviderEndpoint } from "../types.js";
import { buildHeaders, joinUrl, resolveBaseUrl } from "../shared/http.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function splitSystemMessages(messages: LLMMessage[]): { systemInstruction?: string; contents: Array<{ role: string; parts: Array<{ text: string }> }> } {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  const systemInstruction = systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined;
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  return { systemInstruction, contents };
}

function buildGenerationConfig(request: ProviderRequest): Record<string, number | undefined> {
  return {
    temperature: request.temperature,
    maxOutputTokens: request.maxTokens,
  };
}

function buildGeminiUrl(baseUrl: string, model: string, stream: boolean): string {
  const endpoint = `models/${encodeURIComponent(model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  return joinUrl(baseUrl, endpoint);
}

export function mapGeminiChatRequest(config: BaseProviderConfig, request: ProviderRequest): ProviderEndpoint {
  const baseUrl = resolveBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const { systemInstruction, contents } = splitSystemMessages(request.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: buildGenerationConfig(request),
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = new URL(buildGeminiUrl(baseUrl, request.model, false));
  if (config.apiKey) {
    url.searchParams.set("key", config.apiKey);
  }

  return {
    url: url.toString(),
    init: {
      method: "POST",
      headers: buildHeaders(config, {
        "content-type": "application/json",
      }),
      body: JSON.stringify(body),
    },
    timeoutMs: config.timeoutMs,
  };
}

export function mapGeminiStreamRequest(config: BaseProviderConfig, request: ProviderRequest): ProviderEndpoint {
  const baseUrl = resolveBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const { systemInstruction, contents } = splitSystemMessages(request.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: buildGenerationConfig(request),
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = new URL(buildGeminiUrl(baseUrl, request.model, true));
  if (config.apiKey) {
    url.searchParams.set("key", config.apiKey);
  }

  return {
    url: url.toString(),
    init: {
      method: "POST",
      headers: buildHeaders(config, {
        accept: "text/event-stream",
        "content-type": "application/json",
      }),
      body: JSON.stringify(body),
    },
    timeoutMs: config.timeoutMs,
  };
}