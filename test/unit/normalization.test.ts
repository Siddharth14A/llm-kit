import { describe, expect, it } from "vitest";
import { LLMInputError } from "../../src/errors.js";
import { normalizeChatInput, normalizeJSONInput } from "../../src/methods/normalize.js";

describe("normalizeChatInput", () => {
  it("normalizes shorthand prompts with default system prompt and user message", () => {
    const result = normalizeChatInput("Explain vector databases", undefined, "You are concise");

    expect(result.prompt).toBe("Explain vector databases");
    expect(result.system).toBe("You are concise");
    expect(result.messages).toEqual([
      { role: "system", content: "You are concise" },
      { role: "user", content: "Explain vector databases" },
    ]);
  });

  it("preserves existing messages and session metadata", () => {
    const result = normalizeChatInput(
      {
        prompt: "What did I ask before?",
        messages: [{ role: "assistant", content: "You asked about OAuth" }],
        sessionId: "session-1",
      },
      {
        temperature: 0.2,
        maxTokens: 128,
      },
      "You are a backend assistant",
    );

    expect(result.sessionId).toBe("session-1");
    expect(result.temperature).toBe(0.2);
    expect(result.maxTokens).toBe(128);
    expect(result.messages).toEqual([
      { role: "system", content: "You are a backend assistant" },
      { role: "assistant", content: "You asked about OAuth" },
      { role: "user", content: "What did I ask before?" },
    ]);
  });

  it("throws a typed input error for invalid object input", () => {
    expect(() => normalizeChatInput({ nope: true } as never, undefined)).toThrow(LLMInputError);
  });
});

describe("normalizeJSONInput", () => {
  it("injects JSON-only instructions and preserves schema", () => {
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        age: { type: "number" as const },
      },
      required: ["name", "age"],
    };

    const result = normalizeJSONInput({ prompt: "Extract name and age", schema }, undefined, "Be strict");

    expect(result.schema).toBe(schema);
    expect(result.system).toContain("Be strict");
    expect(result.system).toContain("Respond with valid JSON only");
    expect(result.system).toContain("Return JSON that matches this schema");
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "Extract name and age" });
  });

  it("applies shorthand options consistently", () => {
    const result = normalizeJSONInput("Extract name and age", { system: "Be exact", temperature: 0.1 }, undefined);

    expect(result.system).toContain("Be exact");
    expect(result.temperature).toBe(0.1);
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "Extract name and age" });
  });
});
