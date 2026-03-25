import type { BaseProviderConfig, LLMMessage, LLMUsage, ProviderType } from "../types.js";

export interface ProviderEndpoint {
  url: string;
  init: RequestInit;
  timeoutMs?: number;
}

export interface ProviderRequestBody {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderParsedUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ProviderResponseEnvelope<T = unknown> {
  raw: T;
  text: string;
  finishReason?: string;
  usage?: LLMUsage;
}

export type ProviderConfig = BaseProviderConfig;
export type ProviderName = ProviderType;
