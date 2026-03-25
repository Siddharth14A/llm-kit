import { LLMConfigurationError } from "../errors.js";
import type { BaseProviderConfig, FallbackConfig, LLMConfig, MemoryOption, ProviderType } from "../types.js";

export interface ResolvedProviderConfig extends BaseProviderConfig {
  provider: ProviderType;
  model: string;
  retries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  timeoutMs: number;
  headers: Record<string, string>;
}

export interface ResolvedLLMConfig extends ResolvedProviderConfig {
  fallback: ResolvedProviderConfig[];
  defaultSystemPrompt?: string;
  memory?: MemoryOption;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => typeof value === "string" && value.length > 0)
      .map(([key, value]) => [key, value]),
  );
}

function normalizeRetryCount(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_RETRIES;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeDelay(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function resolveProviderConfig(config: BaseProviderConfig): ResolvedProviderConfig {
  if (!isNonEmptyString(config.provider)) {
    throw new LLMConfigurationError("llm-kit configuration requires a provider.");
  }

  if (!isNonEmptyString(config.model)) {
    throw new LLMConfigurationError(`llm-kit configuration for provider "${config.provider}" requires a model.`);
  }

  const provider = config.provider.trim() as ProviderType;
  const model = config.model.trim();
  const baseUrl = isNonEmptyString(config.baseUrl) ? config.baseUrl.trim() : undefined;
  const apiKey = isNonEmptyString(config.apiKey) ? config.apiKey.trim() : undefined;
  const headers = normalizeHeaders(config.headers);

  return {
    ...config,
    provider,
    model,
    baseUrl,
    apiKey,
    headers,
    retries: normalizeRetryCount(config.retries),
    retryDelayMs: normalizeDelay(config.retryDelayMs, DEFAULT_RETRY_DELAY_MS),
    maxRetryDelayMs: Math.max(
      normalizeDelay(config.maxRetryDelayMs, DEFAULT_MAX_RETRY_DELAY_MS),
      normalizeDelay(config.retryDelayMs, DEFAULT_RETRY_DELAY_MS),
    ),
    timeoutMs: normalizeDelay(config.timeoutMs, DEFAULT_TIMEOUT_MS),
  };
}

function dedupeFallbacks(fallback: ResolvedProviderConfig[], primary: ResolvedProviderConfig): ResolvedProviderConfig[] {
  const seen = new Set<string>();
  const keyFor = (value: Pick<ResolvedProviderConfig, "provider" | "model" | "baseUrl">) =>
    `${value.provider}:${value.model}:${value.baseUrl ?? ""}`;

  const sequence: ResolvedProviderConfig[] = [];
  for (const candidate of [primary, ...fallback]) {
    const key = keyFor(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (candidate !== primary) {
      sequence.push(candidate);
    }
  }

  return sequence;
}

export function normalizeLLMConfig(config: LLMConfig): ResolvedLLMConfig {
  const primary = resolveProviderConfig(config);
  const fallback = Array.isArray(config.fallback) ? config.fallback : [];
  const resolvedFallback = fallback.map((candidate: FallbackConfig) => resolveProviderConfig(candidate));

  return {
    ...primary,
    fallback: dedupeFallbacks(resolvedFallback, primary),
    defaultSystemPrompt: isNonEmptyString(config.defaultSystemPrompt) ? config.defaultSystemPrompt.trim() : undefined,
    memory: config.memory,
  };
}
