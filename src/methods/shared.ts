import type { LLMMessage, NormalizedLLMRequest } from "../types.js";
import type { BuildConversationResult, JSONPromptResult, MethodRuntime } from "./types.js";

export type MethodConversationInput = BuildConversationResult | JSONPromptResult;

export function mergeConversationHistory(history: LLMMessage[], messages: LLMMessage[]): LLMMessage[] {
  const next = [...messages];
  if (history[0]?.role === "system" && next[0]?.role === "system") {
    next.shift();
  }

  return [...history, ...next];
}

export async function loadConversationHistory(
  runtime: MethodRuntime,
  sessionId: string | undefined,
): Promise<LLMMessage[]> {
  if (!sessionId || !runtime.loadSessionMessages) {
    return [];
  }

  const history = await runtime.loadSessionMessages(sessionId);
  return history ? [...history] : [];
}

export async function persistConversationHistory(
  runtime: MethodRuntime,
  sessionId: string | undefined,
  messages: LLMMessage[],
  assistantText: string,
): Promise<void> {
  if (!sessionId || !runtime.saveSessionMessages) {
    return;
  }

  await runtime.saveSessionMessages(sessionId, [...messages, { role: "assistant", content: assistantText }]);
}

export async function buildConversationRequest(
  runtime: MethodRuntime,
  input: MethodConversationInput,
): Promise<NormalizedLLMRequest> {
  const history = await loadConversationHistory(runtime, input.sessionId);

  return {
    prompt: input.prompt,
    messages: mergeConversationHistory(history, input.messages),
    system: input.system,
    sessionId: input.sessionId,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  };
}
