import { LLMKitError, LLMTimeoutError } from "../errors.js";
import { parseJsonFromText } from "../json/parse.js";
import { createSessionMemory } from "../memory/sessionMemory.js";
import type { MethodRuntime } from "../methods/types.js";
import { getProviderAdapter as getBuiltInProviderAdapter } from "../providers/factory.js";
import type {
  JSONSchemaLike,
  LLMChatResponse,
  LLMConfig,
  LLMMessage,
  NormalizedLLMRequest,
  ProviderAdapter,
  ProviderRequest,
  ProviderType,
} from "../types.js";
import { normalizeExecutionRequest } from "./normalize.js";
import { createTimer } from "./timers.js";
import { normalizeLLMConfig, type ResolvedLLMConfig, type ResolvedProviderConfig } from "./config.js";
import { buildProviderSequence, executeWithFallback, type ProviderAttempt } from "./fallback.js";
import { executeWithRetries } from "./retries.js";
import { mergeUsage } from "./usage.js";

export interface ProviderResolver {
  resolve(provider: ResolvedProviderConfig["provider"]): Promise<ProviderAdapter> | ProviderAdapter;
}

export interface LLMCoreDependencies {
  resolveProvider?: ProviderResolver["resolve"];
  now?: () => number;
}

function requireResolver(deps: LLMCoreDependencies): ProviderResolver["resolve"] {
  if (typeof deps.resolveProvider === "function") {
    return deps.resolveProvider.bind(deps);
  }

  return (provider) => getBuiltInProviderAdapter(provider);
}

async function resolveProviderAdapter(
  resolve: ProviderResolver["resolve"],
  provider: ResolvedProviderConfig["provider"],
): Promise<ProviderAdapter> {
  const adapter = await resolve(provider);
  if (!adapter) {
    throw new LLMKitError(`Provider resolver returned no adapter for "${provider}".`);
  }

  if (adapter.provider !== provider) {
    throw new LLMKitError(`Provider resolver returned adapter for "${adapter.provider}" when "${provider}" was requested.`);
  }

  return adapter;
}

function buildProviderRequest(config: ResolvedLLMConfig, request: ReturnType<typeof normalizeExecutionRequest>): ProviderRequest {
  return {
    ...request,
    model: config.model,
  };
}

function withAttemptModel(request: NormalizedLLMRequest, model: string): ProviderRequest {
  return {
    ...request,
    model,
  };
}

async function runWithTimeout<T>(operation: Promise<T>, timeoutMs: number, provider: ProviderType): Promise<T> {
  if (timeoutMs <= 0) {
    return operation;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LLMTimeoutError(provider));
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function executeProviderChat(
  resolve: ProviderResolver["resolve"],
  attempt: ProviderAttempt,
  request: NormalizedLLMRequest,
  clock?: () => number,
): Promise<LLMChatResponse> {
  const adapter = await resolveProviderAdapter(resolve, attempt.config.provider);
  const timer = createTimer(clock);

  const result = await executeWithRetries(
    () => runWithTimeout(adapter.chat(attempt.config, withAttemptModel(request, attempt.config.model)), attempt.config.timeoutMs, attempt.config.provider),
    {
      retries: attempt.config.retries,
      retryDelayMs: attempt.config.retryDelayMs,
      maxRetryDelayMs: attempt.config.maxRetryDelayMs,
    },
  );

  return {
    text: result.text,
    finishReason: result.finishReason,
    usage: result.usage,
    meta: {
      provider: attempt.config.provider,
      model: attempt.config.model,
      latencyMs: timer.elapsed(),
      fallbackUsed: attempt.fallbackUsed,
    },
  };
}

async function executeProviderStream(
  resolve: ProviderResolver["resolve"],
  attempt: ProviderAttempt,
  request: NormalizedLLMRequest,
) {
  const adapter = await resolveProviderAdapter(resolve, attempt.config.provider);
  const stream = await executeWithRetries(
    () => runWithTimeout(adapter.stream(attempt.config, withAttemptModel(request, attempt.config.model)), attempt.config.timeoutMs, attempt.config.provider),
    {
      retries: attempt.config.retries,
      retryDelayMs: attempt.config.retryDelayMs,
      maxRetryDelayMs: attempt.config.maxRetryDelayMs,
    },
  );

  return {
    stream,
    meta: {
      provider: attempt.config.provider,
      model: attempt.config.model,
    },
  };
}

export function createLLM(config: LLMConfig, deps: LLMCoreDependencies = {}): MethodRuntime {
  const resolvedConfig = normalizeLLMConfig(config);
  const resolveProvider = requireResolver(deps);
  const sessionMemory = resolvedConfig.memory ? createSessionMemory({ store: resolvedConfig.memory }) : undefined;

  async function executeChat(request: ReturnType<typeof normalizeExecutionRequest>): Promise<LLMChatResponse> {
    const normalizedRequest = normalizeExecutionRequest(request);
    const providerRequest = buildProviderRequest(resolvedConfig, normalizedRequest);
    const attempts = buildProviderSequence(resolvedConfig, resolvedConfig.fallback);

    const { result } = await executeWithFallback(attempts, (attempt) =>
      executeProviderChat(resolveProvider, attempt, providerRequest, deps.now),
    );

    return {
      ...result,
      usage: mergeUsage(result.usage),
    };
  }

  async function executeStream(request: ReturnType<typeof normalizeExecutionRequest>) {
    const normalizedRequest = normalizeExecutionRequest(request);
    const providerRequest = buildProviderRequest(resolvedConfig, normalizedRequest);
    const attempts = buildProviderSequence(resolvedConfig, resolvedConfig.fallback);

    const { result } = await executeWithFallback(attempts, (attempt) =>
      executeProviderStream(resolveProvider, attempt, providerRequest),
    );

    return result;
  }

  return {
    config: resolvedConfig,
    executeChat,
    executeStream,
    extractJSON<T>(rawText: string, schema?: JSONSchemaLike) {
      return parseJsonFromText<T>(rawText, { schema });
    },
    loadSessionMessages(sessionId: string): Promise<LLMMessage[] | undefined> | LLMMessage[] | undefined {
      if (!sessionMemory) {
        return undefined;
      }

      return sessionMemory.load(sessionId);
    },
    saveSessionMessages(sessionId: string, messages: LLMMessage[]): Promise<void> | void {
      if (!sessionMemory) {
        return undefined;
      }

      return sessionMemory.persist(sessionId, messages);
    },
  };
}
