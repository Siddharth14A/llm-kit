import { describe, expect, it } from "vitest";
import { createInMemoryStore } from "../../src/memory/inMemoryStore.js";
import {
  appendSessionMessages,
  clearSessionMessages,
  createSessionMemory,
  loadSessionMessages,
  persistSessionMessages,
} from "../../src/memory/sessionMemory.js";
import type { MemoryStore } from "../../src/types.js";

describe("memory store", () => {
  it("clones seeded and persisted messages defensively", async () => {
    const store = createInMemoryStore({
      sessionA: [{ role: "user", content: "hello" }],
    });

    const first = await store.get("sessionA");
    first[0].content = "mutated";

    const second = await store.get("sessionA");
    expect(second).toEqual([{ role: "user", content: "hello" }]);
  });

  it("supports load, persist, append, and clear session helpers", async () => {
    const memory = createSessionMemory({ store: true });

    await memory.persist("session-1", [{ role: "user", content: "My name is Sid" }]);
    await appendSessionMessages(createInMemoryStore(), "unused", []); // sanity check that helper accepts the contract

    const loaded = await memory.load("session-1");
    expect(loaded).toEqual([{ role: "user", content: "My name is Sid" }]);

    const appended = await memory.append("session-1", [{ role: "assistant", content: "Nice to meet you, Sid" }]);
    expect(appended).toEqual([
      { role: "user", content: "My name is Sid" },
      { role: "assistant", content: "Nice to meet you, Sid" },
    ]);

    await memory.clear("session-1");
    await expect(memory.load("session-1")).resolves.toEqual([]);
  });

  it("falls back to set([]) when a memory store has no clear method", async () => {
    const record: Array<{ sessionId: string; messages: Array<{ role: string; content: string }> }> = [];
    const store: MemoryStore = {
      async get() {
        return [{ role: "assistant" as const, content: "old" }];
      },
      async set(sessionId: string, messages) {
        record.push({ sessionId, messages });
      },
    };

    await clearSessionMessages(store, "session-2");
    expect(record).toEqual([{ sessionId: "session-2", messages: [] }]);
  });

  it("normalizes invalid entries before persisting through helpers", async () => {
    const store = createInMemoryStore();
    await persistSessionMessages(store, "session-3", [
      { role: "user", content: "keep" },
      { role: "assistant" } as never,
      { role: "tool" as never, content: "drop" } as never,
    ]);

    await appendSessionMessages(store, "session-3", [
      { role: "assistant", content: "reply" },
      { role: "user", content: 42 } as never,
    ]);

    await expect(loadSessionMessages(store, "session-3")).resolves.toEqual([
      { role: "user", content: "keep" },
      { role: "assistant", content: "reply" },
    ]);
  });
});
