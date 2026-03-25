import type { BaseProviderConfig, ProviderRequest } from "../../types.js";
import type { ProviderEndpoint } from "../types.js";
import { buildHeaders, joinUrl, resolveBaseUrl } from "../shared/http.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function buildMessages(request: ProviderRequest) {
  return request.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function mapOpenAIChatRequest(config: BaseProviderConfig, request: ProviderRequest): ProviderEndpoint {
  const baseUrl = resolveBaseUrl(config.baseUrl, DEFAULT_BASE_URL);

  return {
    url: joinUrl(baseUrl, "chat/completions"),
    init: {
      method: "POST",
      headers: buildHeaders(config, {
        authorization: config.apiKey ? `Bearer ${config.apiKey}` : undefined,
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        model: request.model,
        messages: buildMessages(request),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    },
    timeoutMs: config.timeoutMs,
  };
}

export function mapOpenAIStreamRequest(config: BaseProviderConfig, request: ProviderRequest): ProviderEndpoint {
  const baseUrl = resolveBaseUrl(config.baseUrl, DEFAULT_BASE_URL);

  return {
    url: joinUrl(baseUrl, "chat/completions"),
    init: {
      method: "POST",
      headers: buildHeaders(config, {
        accept: "text/event-stream",
        authorization: config.apiKey ? `Bearer ${config.apiKey}` : undefined,
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        model: request.model,
        messages: buildMessages(request),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    },
    timeoutMs: config.timeoutMs,
  };
}