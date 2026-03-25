import { createMethodSuite } from "./methods/index.js";
import type {
  ChatInput,
  ChatInputLike,
  JSONInput,
  LLMChatResponse,
  LLMConfig,
  LLMDefaults,
  LLMInstance,
  LLMJSONResponse,
  NodeStreamResponseLike,
  QuickInputLike,
  QuickOptions,
  QuickResponse,
  StreamHandle,
} from "./types.js";
import { createLLM as createCoreLLM, type LLMCoreDependencies } from "./core/index.js";

function mergeDefaults<T extends object>(defaults: LLMDefaults, value?: T): T | undefined {
  if (Object.keys(defaults).length === 0) {
    return value;
  }

  return {
    ...defaults,
    ...(value ?? {}),
  } as T;
}

function applyDefaultsToChatInput(input: ChatInputLike, defaults: LLMDefaults): ChatInputLike {
  if (typeof input === "string" || Object.keys(defaults).length === 0) {
    return input;
  }

  return {
    ...defaults,
    ...input,
  };
}

function applyDefaultsToJSONInput(input: string | JSONInput, defaults: LLMDefaults): string | JSONInput {
  if (typeof input === "string" || Object.keys(defaults).length === 0) {
    return input;
  }

  return {
    ...defaults,
    ...input,
  };
}

function hasSchema(input: QuickInputLike, options?: QuickOptions): boolean {
  return Boolean(
    (typeof input === "object" && input !== null && "schema" in input && input.schema !== undefined) || options?.schema !== undefined,
  );
}

function isFallbackUsed(provider: string, model: string, config: LLMConfig): boolean {
  return provider !== config.provider || model !== config.model;
}

function logDebug(
  enabled: boolean | undefined,
  method: string,
  details: { provider: string; model: string; latencyMs: number; fallbackUsed?: boolean },
): void {
  if (!enabled) {
    return;
  }

  const fallbackLabel = details.fallbackUsed ? "yes" : "no";
  console.info(
    `[llm-kit] ${method} provider=${details.provider} model=${details.model} latencyMs=${details.latencyMs} fallback=${fallbackLabel}`,
  );
}

function writeStreamError(response: NodeStreamResponseLike, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown stream error";

  if (!response.headersSent) {
    response.statusCode = 500;
    response.setHeader?.("content-type", "text/plain; charset=utf-8");
  }

  response.end(`llm-kit stream error: ${message}`);
}

export function createLLM(config: LLMConfig, deps: LLMCoreDependencies = {}): LLMInstance {
  const runtime = createCoreLLM(config, deps);
  const base = createMethodSuite(runtime);

  function build(defaults: LLMDefaults = {}): LLMInstance {
    async function chat(input: ChatInputLike, options?: Omit<ChatInput, "prompt">): Promise<LLMChatResponse> {
      const response = await base.chat(applyDefaultsToChatInput(input, defaults), mergeDefaults(defaults, options));
      logDebug(config.debug, "chat", response.meta);
      return response;
    }

    async function stream(input: ChatInputLike, options?: Omit<ChatInput, "prompt">): Promise<StreamHandle> {
      const startedAt = Date.now();
      const handle = await base.stream(applyDefaultsToChatInput(input, defaults), mergeDefaults(defaults, options));

      return {
        [Symbol.asyncIterator]: () => handle[Symbol.asyncIterator](),
        completed: handle.completed.then((result) => {
          logDebug(config.debug, "stream", {
            provider: result.meta.provider,
            model: result.meta.model,
            latencyMs: Date.now() - startedAt,
            fallbackUsed: isFallbackUsed(result.meta.provider, result.meta.model, config),
          });
          return result;
        }),
      };
    }

    async function json<T = unknown>(
      input: string | JSONInput,
      options?: Omit<JSONInput, "prompt" | "schema">,
    ): Promise<LLMJSONResponse<T>> {
      const response = await base.json<T>(applyDefaultsToJSONInput(input, defaults), mergeDefaults(defaults, options));
      logDebug(config.debug, "json", response.meta);
      return response;
    }

    async function quick<T = unknown>(input: QuickInputLike, options?: QuickOptions): Promise<QuickResponse<T>> {
      if (hasSchema(input, options)) {
        return json<T>(input as string | JSONInput, options);
      }

      return chat(input as ChatInputLike, options);
    }

    async function streamToResponse(
      input: ChatInputLike,
      response: NodeStreamResponseLike,
      options?: Omit<ChatInput, "prompt">,
    ): Promise<void> {
      try {
        const handle = await stream(input, options);
        for await (const chunk of handle) {
          if (chunk.text) {
            response.write(chunk.text);
          }
        }
        await handle.completed;
        response.end();
      } catch (error) {
        writeStreamError(response, error);
      }
    }

    return {
      chat,
      stream,
      json,
      quick,
      streamToResponse,
      withDefaults(nextDefaults: LLMDefaults): LLMInstance {
        return build({
          ...defaults,
          ...nextDefaults,
        });
      },
    };
  }

  return build();
}
