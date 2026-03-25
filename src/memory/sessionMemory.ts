import { LLMInputError } from "../errors.js";
import type { LLMMessage, MemoryOption, MemoryStore } from "../types.js";
import { createInMemoryStore, isInMemoryStore } from "./inMemoryStore.js";
import type { SessionMemory, SessionMemoryOptions } from "./types.js";

function assertSessionId(sessionId: string): void {
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    throw new LLMInputError("sessionId must be a non-empty string.");
  }
}

function normalizeMessages(messages: LLMMessage[]): LLMMessage[] {
  return messages
    .filter(
      (message) =>
        (message?.role === "system" || message?.role === "user" || message?.role === "assistant") &&
        typeof message?.content === "string",
    )
    .map((message) => ({ role: message.role, content: message.content }));
}

export function resolveMemoryStore(memory?: MemoryOption): MemoryStore | undefined {
  if (memory === false || memory == null) {
    return undefined;
  }

  if (memory === true) {
    return createInMemoryStore();
  }

  if (isInMemoryStore(memory)) {
    return memory;
  }

  return memory;
}

export async function loadSessionMessages(store: MemoryStore, sessionId: string): Promise<LLMMessage[]> {
  assertSessionId(sessionId);
  const messages = await store.get(sessionId);
  return normalizeMessages(messages);
}

export async function persistSessionMessages(
  store: MemoryStore,
  sessionId: string,
  messages: LLMMessage[],
): Promise<void> {
  assertSessionId(sessionId);
  await store.set(sessionId, normalizeMessages(messages));
}

export async function appendSessionMessages(
  store: MemoryStore,
  sessionId: string,
  messages: LLMMessage[],
): Promise<LLMMessage[]> {
  assertSessionId(sessionId);
  const current = await loadSessionMessages(store, sessionId);
  const next = current.concat(normalizeMessages(messages));
  await store.set(sessionId, next);
  return next;
}

export async function clearSessionMessages(store: MemoryStore, sessionId: string): Promise<void> {
  assertSessionId(sessionId);
  if (typeof store.clear === "function") {
    await store.clear(sessionId);
    return;
  }

  await store.set(sessionId, []);
}

export function createSessionMemory(options: SessionMemoryOptions = {}): SessionMemory {
  const store = resolveMemoryStore(options.store) ?? createInMemoryStore();

  return {
    load(sessionId: string): Promise<LLMMessage[]> {
      return loadSessionMessages(store, sessionId);
    },
    persist(sessionId: string, messages: LLMMessage[]): Promise<void> {
      return persistSessionMessages(store, sessionId, messages);
    },
    append(sessionId: string, messages: LLMMessage[]): Promise<LLMMessage[]> {
      return appendSessionMessages(store, sessionId, messages);
    },
    clear(sessionId: string): Promise<void> {
      return clearSessionMessages(store, sessionId);
    },
  };
}
