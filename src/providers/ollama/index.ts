import type { ProviderAdapter } from "../../types.js";
import type { BaseProviderConfig, ProviderRequest } from "../../types.js";
import { fetchJson } from "../shared/http.js";
import { createOllamaStreamResult } from "./stream.js";
import { mapOllamaChatRequest } from "./mapRequest.js";
import { mapOllamaChatResponse } from "./mapResponse.js";

export function createOllamaProvider(): ProviderAdapter {
  return {
    provider: "ollama",
    async chat(config: BaseProviderConfig, request: ProviderRequest) {
      const endpoint = mapOllamaChatRequest(config, request);
      const { data } = await fetchJson<unknown>("ollama", endpoint);
      return mapOllamaChatResponse(data as Parameters<typeof mapOllamaChatResponse>[0]);
    },
    async stream(config: BaseProviderConfig, request: ProviderRequest) {
      return createOllamaStreamResult(config, request);
    },
  };
}

export const ollamaProvider: ProviderAdapter = createOllamaProvider();
