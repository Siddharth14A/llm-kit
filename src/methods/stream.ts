import type { ChatInput, LLMStreamChunk, StreamHandle } from "../types.js";
import { buildConversationRequest, persistConversationHistory } from "./shared.js";
import type { MethodRuntime } from "./types.js";
import { normalizeChatInput } from "./normalize.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

export function createStreamMethod(runtime: MethodRuntime) {
  return async function stream(input: string | ChatInput, options?: Omit<ChatInput, "prompt">): Promise<StreamHandle> {
    const normalized = normalizeChatInput(input, options, runtime.config.defaultSystemPrompt);
    const request = await buildConversationRequest(runtime, normalized);
    const executionPromise = runtime.executeStream(request);
    executionPromise.catch(() => undefined);

    const completed = createDeferred<Awaited<StreamHandle["completed"]>>();

    const iterator = (async function* (): AsyncGenerator<LLMStreamChunk, void, unknown> {
      try {
        const execution = await executionPromise;
        const source = execution.stream;
        let assistantText = "";
        let finalFinishReason: string | undefined;
        let finalUsage: Awaited<StreamHandle["completed"]>["usage"];

        for await (const chunk of source) {
          assistantText += chunk.text ?? "";
          if (chunk.finishReason) {
            finalFinishReason = chunk.finishReason;
          }
          if (chunk.usage) {
            finalUsage = chunk.usage;
          }

          yield {
            text: chunk.text,
            done: chunk.done,
            meta: execution.meta,
          };
        }

        const upstreamCompleted = await source.completed;
        if (upstreamCompleted.finishReason) {
          finalFinishReason = upstreamCompleted.finishReason;
        }
        if (upstreamCompleted.usage) {
          finalUsage = upstreamCompleted.usage;
        }

        await persistConversationHistory(runtime, normalized.sessionId, request.messages, assistantText);

        completed.resolve({
          finishReason: finalFinishReason,
          usage: finalUsage,
          meta: execution.meta,
        });
      } catch (error) {
        completed.reject(error);
        throw error;
      }
    })();

    return {
      [Symbol.asyncIterator]: () => iterator,
      completed: completed.promise,
    };
  };
}
