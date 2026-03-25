import type { LLMMessage, MemoryOption, MemoryStore } from "../types.js";

export type { LLMMessage, MemoryOption, MemoryStore };

export interface SessionMemory {
  load(sessionId: string): Promise<LLMMessage[]>;
  persist(sessionId: string, messages: LLMMessage[]): Promise<void>;
  append(sessionId: string, messages: LLMMessage[]): Promise<LLMMessage[]>;
  clear(sessionId: string): Promise<void>;
}

export interface SessionMemoryOptions {
  store?: MemoryOption;
}
