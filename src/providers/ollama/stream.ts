import { ProviderRequestError } from "../../errors.js";
import type { LLMUsage, ProviderStreamResult } from "../../types.js";
import type { BaseProviderConfig, ProviderRequest } from "../../types.js";
import { fetchResponse, safeParseJson } from "../shared/http.js";
import { iterateResponseLines, parseJsonLine } from "../shared/stream.js";
import { mapOllamaStreamRequest } from "./mapRequest.js";
import { extractOllamaStreamDelta } from "./mapResponse.js";

export function createOllamaStreamResult(
  config: BaseProviderConfig,
  request: ProviderRequest,
): Promise<ProviderStreamResult> {
  return (async () => {
    const endpoint = mapOllamaStreamRequest(config, request);
    const { response, clearTimeout } = await fetchResponse("ollama", endpoint);
    const body = response.body;

    if (!body) {
      clearTimeout();
      throw new ProviderRequestError("ollama", "ollama stream returned an empty body");
    }

    let finalFinishReason: string | undefined;
    let finalUsage: LLMUsage | undefined;
    let finalRaw: unknown;
    let resolved = false;
    let resolveCompleted!: (value: { finishReason?: string; usage?: LLMUsage; raw?: unknown }) => void;

    const completed = new Promise<{ finishReason?: string; usage?: LLMUsage; raw?: unknown }>((resolve) => {
      resolveCompleted = resolve;
    });

    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolveCompleted({
          finishReason: finalFinishReason,
          usage: finalUsage,
          raw: finalRaw,
        });
      }
    };

    const stream: ProviderStreamResult = {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const line of iterateResponseLines(body)) {
            const parsed = safeParseJson<Record<string, unknown>>(line) ?? parseJsonLine<Record<string, unknown>>(line);
            if (!parsed) {
              continue;
            }

            finalRaw = parsed;
            const delta = extractOllamaStreamDelta(parsed as Parameters<typeof extractOllamaStreamDelta>[0]);
            if (delta.finishReason) {
              finalFinishReason = delta.finishReason;
            }
            if (delta.usage) {
              finalUsage = delta.usage;
            }

            if (delta.text.length > 0) {
              yield {
                text: delta.text,
                finishReason: delta.finishReason,
                usage: delta.usage,
                raw: parsed,
              };
            }

            if (delta.done) {
              yield {
                text: "",
                done: true,
                finishReason: delta.finishReason,
                usage: delta.usage,
                raw: parsed,
              };
              break;
            }
          }
        } finally {
          clearTimeout();
          finish();
        }
      },
      completed,
    };

    return stream;
  })();
}