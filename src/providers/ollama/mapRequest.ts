import type { ProviderEndpoint } from "../types.js";
import { buildHeaders, joinUrl, resolveBaseUrl } from "../shared/http.js";
import type { BaseProviderConfig, ProviderRequest } from "../../types.js";

const DEFAULT_BASE_URL = "http://localhost:11434";

function buildOptions(request: ProviderRequest): Record<string, number | undefined> {
  return {
    temperature: request.temperature,
    num_predict: request.maxTokens,
  };
}

export function mapOllamaChatRequest(config: BaseProviderConfig, request: ProviderRequest): ProviderEndpoint {
  const baseUrl = resolveBaseUrl(config.baseUrl, DEFAULT_BASE_URL);

  return {
    url: joinUrl(baseUrl, "api/chat"),
    init: {
      method: "POST",
      headers: buildHeaders(config, {
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: buildOptions(request),
      }),
    },
    timeoutMs: config.timeoutMs,
  };
}

export function mapOllamaStreamRequest(config: BaseProviderConfig, request: ProviderRequest): ProviderEndpoint {
  const baseUrl = resolveBaseUrl(config.baseUrl, DEFAULT_BASE_URL);

  return {
    url: joinUrl(baseUrl, "api/chat"),
    init: {
      method: "POST",
      headers: buildHeaders(config, {
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        options: buildOptions(request),
      }),
    },
    timeoutMs: config.timeoutMs,
  };
}
