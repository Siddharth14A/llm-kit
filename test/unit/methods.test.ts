import { describe, expect, it, vi, afterEach } from "vitest";
import { createLLM } from "../../src/createLLM.js";
import { ProviderRequestError } from "../../src/errors.js";
import type { ProviderAdapter, ProviderRequest } from "../../src/types.js";

function createCompletedStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of chunks) {
        yield { text };
      }
      yield { text: "", done: true };
    },
    completed: Promise.resolve({ finishReason: "stop" as const }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public stream method", () => {
  it("uses fallback provider metadata and fallback model when the primary stream fails", async () => {
    let receivedModel: string | undefined;

    const adapters: Record<string, ProviderAdapter> = {
      openai: {
        provider: "openai",
        async chat() {
          throw new Error("unused");
        },
        async stream() {
          throw new ProviderRequestError("openai", "temporary outage", { status: 503, retryable: true });
        },
      },
      ollama: {
        provider: "ollama",
        async chat() {
          throw new Error("unused");
        },
        async stream(_config, request: ProviderRequest) {
          receivedModel = request.model;
          return createCompletedStream(["fallback text"]);
        },
      },
    };

    const llm = createLLM(
      {
        provider: "openai",
        model: "primary-model",
        fallback: [{ provider: "ollama", model: "fallback-model" }],
      },
      {
        resolveProvider(provider) {
          return adapters[provider];
        },
      },
    );

    const stream = await llm.stream("hello");
    const chunks: string[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk.text);
      expect(chunk.meta).toEqual({ provider: "ollama", model: "fallback-model" });
    }

    expect(receivedModel).toBe("fallback-model");
    expect(chunks.join("")).toContain("fallback text");
    await expect(stream.completed).resolves.toEqual({
      finishReason: "stop",
      usage: undefined,
      meta: { provider: "ollama", model: "fallback-model" },
    });
  });

  it("supports shorthand options for json() consistently", async () => {
    const llm = createLLM(
      { provider: "openai", model: "test-model" },
      {
        resolveProvider() {
          return {
            provider: "openai",
            async chat() {
              return {
                text: '{"ok":true}',
              };
            },
            async stream() {
              return createCompletedStream([]);
            },
          };
        },
      },
    );

    await expect(llm.json("Return ok", { system: "Be strict" })).resolves.toMatchObject({
      data: { ok: true },
      meta: {
        provider: "openai",
        model: "test-model",
        parseStrategy: "direct",
      },
    });
  });
});

describe("developer experience helpers", () => {
  it("routes quick() to chat() when no schema is provided", async () => {
    const llm = createLLM(
      { provider: "openai", model: "test-model" },
      {
        resolveProvider() {
          return {
            provider: "openai",
            async chat() {
              return {
                text: "plain text",
                finishReason: "stop",
              };
            },
            async stream() {
              return createCompletedStream([]);
            },
          };
        },
      },
    );

    await expect(llm.quick("Say hi")).resolves.toMatchObject({ text: "plain text" });
  });

  it("routes quick() to json() when a schema is provided", async () => {
    const llm = createLLM(
      { provider: "openai", model: "test-model" },
      {
        resolveProvider() {
          return {
            provider: "openai",
            async chat() {
              return {
                text: '{"ok":true}',
              };
            },
            async stream() {
              return createCompletedStream([]);
            },
          };
        },
      },
    );

    await expect(
      llm.quick("Return ok", {
        schema: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
          },
          required: ["ok"],
        },
      }),
    ).resolves.toMatchObject({ data: { ok: true } });
  });

  it("applies withDefaults() without overriding explicit per-call options", async () => {
    const captured: Array<{ system?: string; temperature?: number }> = [];
    const llm = createLLM(
      { provider: "openai", model: "test-model" },
      {
        resolveProvider() {
          return {
            provider: "openai",
            async chat(_config, request) {
              const firstSystem = request.messages.find((message) => message.role === "system")?.content;
              captured.push({ system: firstSystem, temperature: request.temperature });
              return {
                text: "ok",
              };
            },
            async stream() {
              return createCompletedStream([]);
            },
          };
        },
      },
    ).withDefaults({
      system: "Default system",
      temperature: 0.3,
    });

    await llm.chat("hello");
    await llm.chat("override", { system: "Explicit system", temperature: 0.7 });

    expect(captured).toEqual([
      { system: "Default system", temperature: 0.3 },
      { system: "Explicit system", temperature: 0.7 },
    ]);
  });

  it("logs concise debug output", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const llm = createLLM(
      { provider: "openai", model: "test-model", debug: true },
      {
        resolveProvider() {
          return {
            provider: "openai",
            async chat() {
              return {
                text: "ok",
              };
            },
            async stream() {
              return createCompletedStream([]);
            },
          };
        },
      },
    );

    await llm.chat("hello");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toContain("[llm-kit] chat provider=openai model=test-model");
  });

  it("pipes stream output to a Node-style response and ends it", async () => {
    const writes: string[] = [];
    const response = {
      statusCode: 200,
      headersSent: false,
      write(chunk: string | Uint8Array) {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      },
      end(chunk?: string | Uint8Array) {
        if (chunk) {
          writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
        }
        writes.push("[end]");
      },
      setHeader() {
        return undefined;
      },
    };

    const llm = createLLM(
      { provider: "openai", model: "test-model" },
      {
        resolveProvider() {
          return {
            provider: "openai",
            async chat() {
              return {
                text: "unused",
              };
            },
            async stream() {
              return createCompletedStream(["hello", " world"]);
            },
          };
        },
      },
    );

    await llm.streamToResponse("hello", response);

    expect(writes).toEqual(["hello", " world", "[end]"]);
  });
});
