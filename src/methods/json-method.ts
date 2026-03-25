import { parseJsonFromText } from "../json/parse.js";
import type { JSONInput, JSONSchemaLike, LLMJSONResponse } from "../types.js";
import { buildConversationRequest, persistConversationHistory } from "./shared.js";
import type { MethodRuntime } from "./types.js";
import { normalizeJSONInput } from "./normalize.js";

export function createJSONMethod(runtime: MethodRuntime) {
  return async function json<T = unknown>(input: string | JSONInput, options?: Omit<JSONInput, "prompt" | "schema">): Promise<LLMJSONResponse<T>> {
    const normalized = normalizeJSONInput(input, options, runtime.config.defaultSystemPrompt);
    const request = await buildConversationRequest(runtime, normalized);
    const response = await runtime.executeChat(request);

    const extractor: (rawText: string, schema?: JSONSchemaLike) => PromiseLike<{ data: T; parseStrategy?: string }> | { data: T; parseStrategy?: string } =
      runtime.extractJSON ?? ((rawText: string, schema?: JSONSchemaLike) => parseJsonFromText<T>(rawText, { schema }));

    const parsed = await Promise.resolve(extractor(response.text, normalized.schema));

    await persistConversationHistory(runtime, normalized.sessionId, request.messages, response.text);

    return {
      data: parsed.data,
      rawText: response.text,
      usage: response.usage,
      meta: {
        ...response.meta,
        parseStrategy: parsed.parseStrategy,
      },
    };
  };
}
