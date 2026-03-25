import type { ProviderAdapter } from "../../types.js";
import type { BaseProviderConfig, ProviderRequest } from "../../types.js";
import { fetchJson } from "../shared/http.js";
import { createGeminiStreamResult } from "./stream.js";
import { mapGeminiChatRequest } from "./mapRequest.js";
import { mapGeminiChatResponse } from "./mapResponse.js";

export function createGeminiProvider(): ProviderAdapter {
  return {
    provider: "gemini",
    async chat(config: BaseProviderConfig, request: ProviderRequest) {
      const endpoint = mapGeminiChatRequest(config, request);
      const { data } = await fetchJson<unknown>("gemini", endpoint);
      return mapGeminiChatResponse(data as Parameters<typeof mapGeminiChatResponse>[0]);
    },
    async stream(config: BaseProviderConfig, request: ProviderRequest) {
      return createGeminiStreamResult(config, request);
    },
  };
}

export const geminiProvider: ProviderAdapter = createGeminiProvider();
