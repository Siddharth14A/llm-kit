import { describe, expect, it, vi, afterEach } from "vitest";
import { ProviderAuthenticationError, ProviderRequestError, LLMTimeoutError } from "../../src/errors.js";
import { fetchJson, fetchResponse, isRetryableStatus } from "../../src/providers/shared/http.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("provider HTTP helpers", () => {
  it("classifies retryable statuses", () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
  });

  it("maps server failures to retryable provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "temporary upstream failure" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      fetchJson("openai", {
        url: "https://example.invalid/v1/chat/completions",
        init: { method: "POST" },
      }),
    ).rejects.toMatchObject({
      name: ProviderRequestError.name,
      provider: "openai",
      status: 500,
      retryable: true,
    });
  });

  it("maps auth failures to authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })),
    );

    await expect(
      fetchJson("gemini", {
        url: "https://example.invalid/v1/models",
        init: { method: "GET" },
      }),
    ).rejects.toMatchObject({
      name: ProviderAuthenticationError.name,
      provider: "gemini",
      status: 401,
      retryable: false,
    });
  });

  it("maps network failures to retryable provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket closed")));

    await expect(
      fetchJson("ollama", {
        url: "http://localhost:11434/api/chat",
        init: { method: "POST" },
      }),
    ).rejects.toMatchObject({
      name: ProviderRequestError.name,
      provider: "ollama",
      retryable: true,
    });
  });

  it("maps abort-style failures to timeout errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );

    await expect(
      fetchJson("openai", {
        url: "https://example.invalid/v1/chat/completions",
        init: { method: "POST" },
      }),
    ).rejects.toBeInstanceOf(LLMTimeoutError);
  });

  it("returns the response object for successful fetchResponse calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    );

    const result = await fetchResponse("openai", {
      url: "https://example.invalid/v1/chat/completions",
      init: { method: "POST" },
    });

    expect(result.response.status).toBe(200);
    result.clearTimeout();
  });
});
