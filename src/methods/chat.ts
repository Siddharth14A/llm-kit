import type { ChatInput, LLMChatResponse } from "../types.js";
import { buildConversationRequest, persistConversationHistory } from "./shared.js";
import type { MethodRuntime } from "./types.js";
import { normalizeChatInput } from "./normalize.js";

export function createChatMethod(runtime: MethodRuntime) {
  return async function chat(input: string | ChatInput, options?: Omit<ChatInput, "prompt">): Promise<LLMChatResponse> {
    const normalized = normalizeChatInput(input, options, runtime.config.defaultSystemPrompt);
    const request = await buildConversationRequest(runtime, normalized);
    const response = await runtime.executeChat(request);

    await persistConversationHistory(runtime, normalized.sessionId, request.messages, response.text);

    return response;
  };
}
