import type { LLMMessage, MemoryStore } from "../types.js";

function cloneMessage(message: LLMMessage): LLMMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

function cloneMessages(messages: LLMMessage[]): LLMMessage[] {
  return messages.map(cloneMessage);
}

function normalizeMessages(messages: LLMMessage[]): LLMMessage[] {
  return messages
    .filter((message) => typeof message?.role === "string" && typeof message?.content === "string")
    .map(cloneMessage);
}

export function createInMemoryStore(seed?: Record<string, LLMMessage[]>): MemoryStore {
  const sessions = new Map<string, LLMMessage[]>();

  if (seed) {
    for (const [sessionId, messages] of Object.entries(seed)) {
      sessions.set(sessionId, normalizeMessages(messages));
    }
  }

  return {
    async get(sessionId: string): Promise<LLMMessage[]> {
      const messages = sessions.get(sessionId) ?? [];
      return cloneMessages(messages);
    },
    async set(sessionId: string, messages: LLMMessage[]): Promise<void> {
      sessions.set(sessionId, normalizeMessages(messages));
    },
    async clear(sessionId: string): Promise<void> {
      sessions.delete(sessionId);
    },
  };
}

export function isInMemoryStore(value: unknown): value is MemoryStore {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as MemoryStore).get === "function" &&
      typeof (value as MemoryStore).set === "function",
  );
}
