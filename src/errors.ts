import type { ProviderType } from "./types.js";

export class LLMKitError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.cause = options?.cause;
  }
}

export class LLMConfigurationError extends LLMKitError {}

export class LLMInputError extends LLMKitError {}

export class ProviderRequestError extends LLMKitError {
  readonly provider: ProviderType;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    provider: ProviderType,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options);
    this.provider = provider;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

export class ProviderAuthenticationError extends ProviderRequestError {
  constructor(provider: ProviderType, message = `Authentication failed for provider "${provider}"`, cause?: unknown) {
    super(provider, message, { status: 401, retryable: false, cause });
  }
}

export class LLMTimeoutError extends ProviderRequestError {
  constructor(provider: ProviderType, message = `Request timed out for provider "${provider}"`, cause?: unknown) {
    super(provider, message, { retryable: true, cause });
  }
}

export class LLMJSONParseError extends LLMKitError {
  readonly rawText: string;
  readonly parseStrategy?: string;

  constructor(message: string, rawText: string, options?: { parseStrategy?: string; cause?: unknown }) {
    super(message, options);
    this.rawText = rawText;
    this.parseStrategy = options?.parseStrategy;
  }
}

export class LLMFallbackExhaustedError extends LLMKitError {
  readonly errors: Error[];

  constructor(message: string, errors: Error[]) {
    super(message);
    this.errors = errors;
  }
}
