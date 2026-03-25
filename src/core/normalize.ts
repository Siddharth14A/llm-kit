import type { NormalizedLLMRequest } from "../types.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMessage(message: NormalizedLLMRequest["messages"][number]): NormalizedLLMRequest["messages"][number] {
  return {
    role: message.role,
    content: message.content.trim(),
  };
}

export function normalizeExecutionRequest(request: NormalizedLLMRequest): NormalizedLLMRequest {
  const prompt = request.prompt.trim();
  if (!isNonEmptyString(prompt)) {
    throw new TypeError("llm-kit requires a non-empty prompt.");
  }

  const messages = Array.isArray(request.messages)
    ? request.messages
        .filter((message) => isNonEmptyString(message?.role) && isNonEmptyString(message?.content))
        .map(normalizeMessage)
    : [];

  return {
    ...request,
    prompt,
    messages,
    system: isNonEmptyString(request.system) ? request.system.trim() : undefined,
    sessionId: isNonEmptyString(request.sessionId) ? request.sessionId.trim() : undefined,
  };
}
