import { LLMKitError } from "../errors.js";
import type { ProviderAdapter, ProviderType } from "../types.js";
import { createGeminiProvider, geminiProvider } from "./gemini/index.js";
import { createOllamaProvider, ollamaProvider } from "./ollama/index.js";
import { createOpenAICompatibleProvider, openaiProvider } from "./openai/index.js";

const providerCache: Partial<Record<ProviderType, ProviderAdapter>> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

export function getProviderAdapter(provider: ProviderType): ProviderAdapter {
  const adapter = providerCache[provider];
  if (adapter) {
    return adapter;
  }

  switch (provider) {
    case "openai":
      providerCache.openai = createOpenAICompatibleProvider();
      return providerCache.openai;
    case "gemini":
      providerCache.gemini = createGeminiProvider();
      return providerCache.gemini;
    case "ollama":
      providerCache.ollama = createOllamaProvider();
      return providerCache.ollama;
    default:
      throw new LLMKitError(`Unsupported provider: ${provider}`);
  }
}