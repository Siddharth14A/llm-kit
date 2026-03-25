import type { BaseProviderConfig, ProviderAdapter, ProviderRequest } from "../../types.js";
import { fetchJson } from "../shared/http.js";
import { createOpenAIStreamResult } from "./stream.js";
import { mapOpenAIChatRequest } from "./mapRequest.js";
import { mapOpenAIChatResponse } from "./mapResponse.js";

export function createOpenAICompatibleProvider(): ProviderAdapter {
  return {
    provider: "openai",
    async chat(config: BaseProviderConfig, request: ProviderRequest) {
      const endpoint = mapOpenAIChatRequest(config, request);
      const { data } = await fetchJson<unknown>("openai", endpoint);
      return mapOpenAIChatResponse(data as Parameters<typeof mapOpenAIChatResponse>[0]);
    },
    async stream(config: BaseProviderConfig, request: ProviderRequest) {
      return createOpenAIStreamResult(config, request);
    },
  };
}

export const openaiProvider: ProviderAdapter = createOpenAICompatibleProvider();