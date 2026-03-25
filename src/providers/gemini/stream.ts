import { ProviderRequestError } from "../../errors.js";
import type { LLMUsage, ProviderStreamResult } from "../../types.js";
import type { BaseProviderConfig, ProviderRequest } from "../../types.js";
import { fetchResponse, safeParseJson } from "../shared/http.js";
import { extractSseData, iterateResponseLines } from "../shared/stream.js";
import { mapGeminiStreamRequest } from "./mapRequest.js";
import { extractGeminiStreamDelta } from "./mapResponse.js";

export function createGeminiStreamResult(
  config: BaseProviderConfig,
  request: ProviderRequest,
): Promise<ProviderStreamResult> {
  return (async () => {
    const endpoint = mapGeminiStreamRequest(config, request);
    const { response, clearTimeout } = await fetchResponse("gemini", endpoint);
    const body = response.body;

    if (!body) {
      clearTimeout();
      throw new ProviderRequestError("gemini", "gemini stream returned an empty body");
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
            const data = extractSseData(line);
            if (!data) {
              continue;
            }

            if (data === "[DONE]") {
              yield { text: "", done: true, finishReason: finalFinishReason, usage: finalUsage, raw: finalRaw };
              break;
            }

            const parsed = safeParseJson<{
              candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
            }>(data);

            if (!parsed) {
              continue;
            }

            finalRaw = parsed;
            const delta = extractGeminiStreamDelta(parsed);
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