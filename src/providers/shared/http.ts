import { LLMTimeoutError, ProviderAuthenticationError, ProviderRequestError } from "../../errors.js";
import type { BaseProviderConfig, ProviderType } from "../../types.js";
import type { ProviderEndpoint } from "../types.js";

const DEFAULT_TIMEOUT_MS = 60_000;

export function resolveBaseUrl(baseUrl: string | undefined, fallback: string): string {
  return (baseUrl ?? fallback).replace(/\/+$/, "");
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

export function buildHeaders(
  config: BaseProviderConfig,
  extra?: Record<string, string | undefined>,
): Record<string, string> {
  return {
    accept: "application/json",
    ...Object.fromEntries(
      Object.entries(config.headers ?? {}).filter(([, value]) => typeof value === "string" && value.length > 0),
    ),
    ...Object.fromEntries(Object.entries(extra ?? {}).filter(([, value]) => typeof value === "string" && value.length > 0)),
  };
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function createAbortController(provider: ProviderType, timeoutMs?: number): {
  controller: AbortController;
  clearTimeout: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new LLMTimeoutError(provider)),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  return {
    controller,
    clearTimeout: () => clearTimeout(timer),
  };
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const nestedError = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : undefined;
  const candidates = [record.error, record.message, record.detail, nestedError?.message, nestedError?.error];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return undefined;
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function mapHttpError(provider: ProviderType, response: Response, bodyText: string): ProviderRequestError {
  const parsed = safeParseJson(bodyText);
  const messageFromBody = extractErrorMessage(parsed) ?? bodyText.trim();
  const message = messageFromBody || `Request failed with status ${response.status}`;

  if (response.status === 401 || response.status === 403) {
    return new ProviderAuthenticationError(provider, message);
  }

  return new ProviderRequestError(provider, `${provider} request failed: ${message}`, {
    status: response.status,
    retryable: isRetryableStatus(response.status),
  });
}

export function safeParseJson<T = unknown>(input: string): T | undefined {
  if (!input.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(input) as T;
  } catch {
    return undefined;
  }
}

export async function fetchJson<T>(
  provider: ProviderType,
  endpoint: ProviderEndpoint,
): Promise<{ data: T; response: Response }> {
  const { controller, clearTimeout } = createAbortController(provider, endpoint.timeoutMs);

  try {
    const response = await fetch(endpoint.url, {
      ...endpoint.init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await readResponseText(response);
      throw mapHttpError(provider, response, bodyText);
    }

    const data = (await response.json()) as T;
    return { data, response };
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      throw error;
    }

    if (error instanceof LLMTimeoutError) {
      throw error;
    }

    if ((error as { name?: string }).name === "AbortError") {
      throw new LLMTimeoutError(provider, undefined, error);
    }

    throw new ProviderRequestError(provider, `${provider} request failed`, {
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout();
  }
}

export async function fetchResponse(
  provider: ProviderType,
  endpoint: ProviderEndpoint,
): Promise<{ response: Response; clearTimeout: () => void }> {
  const { controller, clearTimeout } = createAbortController(provider, endpoint.timeoutMs);

  try {
    const response = await fetch(endpoint.url, {
      ...endpoint.init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await readResponseText(response);
      throw mapHttpError(provider, response, bodyText);
    }

    return { response, clearTimeout };
  } catch (error) {
    clearTimeout();

    if (error instanceof ProviderRequestError) {
      throw error;
    }

    if (error instanceof LLMTimeoutError) {
      throw error;
    }

    if ((error as { name?: string }).name === "AbortError") {
      throw new LLMTimeoutError(provider, undefined, error);
    }

    throw new ProviderRequestError(provider, `${provider} request failed`, {
      retryable: true,
      cause: error,
    });
  }
}