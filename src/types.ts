export type ProviderType = "openai" | "gemini" | "ollama";

export type LLMRole = "system" | "user" | "assistant";

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LLMResponseMeta {
  provider: ProviderType;
  model: string;
  latencyMs: number;
  fallbackUsed?: boolean;
  parseStrategy?: string;
}

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface RetryConfig {
  retries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export interface BaseProviderConfig extends RetryConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface MemoryStore {
  get(sessionId: string): Promise<LLMMessage[]> | LLMMessage[];
  set(sessionId: string, messages: LLMMessage[]): Promise<void> | void;
  clear?(sessionId: string): Promise<void> | void;
}

export type MemoryOption = boolean | MemoryStore;

export interface FallbackConfig extends BaseProviderConfig {}

export interface LLMConfig extends BaseProviderConfig {
  fallback?: FallbackConfig[];
  memory?: MemoryOption;
  defaultSystemPrompt?: string;
  debug?: boolean;
}

export interface LLMMethodOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  messages?: LLMMessage[];
}

export interface ChatInput extends LLMMethodOptions {
  prompt: string;
}

export type ChatInputLike = string | ChatInput;

export interface JSONSchemaLike {
  type?: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: Record<string, JSONSchemaLike>;
  items?: JSONSchemaLike;
  required?: string[];
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean;
}

export interface JSONInput<TSchema = JSONSchemaLike> extends ChatInput {
  schema?: TSchema;
}

export type JSONInputLike<TSchema = JSONSchemaLike> = string | JSONInput<TSchema>;
export type QuickInputLike<TSchema = JSONSchemaLike> = ChatInputLike | JSONInputLike<TSchema>;
export type QuickOptions<TSchema = JSONSchemaLike> = Omit<JSONInput<TSchema>, "prompt">;
export type QuickResponse<T = unknown> = LLMChatResponse | LLMJSONResponse<T>;
export type LLMDefaults = LLMMethodOptions;

export interface NodeStreamResponseLike {
  headersSent?: boolean;
  statusCode?: number;
  setHeader?(name: string, value: string): void;
  write(chunk: string | Uint8Array): void;
  end(chunk?: string | Uint8Array): void;
}

export interface NormalizedLLMRequest extends LLMMethodOptions {
  prompt: string;
  messages: LLMMessage[];
}

export interface ProviderChatResult {
  text: string;
  finishReason?: string;
  usage?: LLMUsage;
  raw?: unknown;
}

export interface ProviderStreamChunk {
  text: string;
  done?: boolean;
  finishReason?: string;
  usage?: LLMUsage;
  raw?: unknown;
}

export interface ProviderStreamResult extends AsyncIterable<ProviderStreamChunk> {
  completed: Promise<{
    finishReason?: string;
    usage?: LLMUsage;
    raw?: unknown;
  }>;
}

export interface ProviderRequest extends NormalizedLLMRequest {
  model: string;
}

export interface ProviderAdapter {
  readonly provider: ProviderType;
  chat(config: BaseProviderConfig, request: ProviderRequest): Promise<ProviderChatResult>;
  stream(config: BaseProviderConfig, request: ProviderRequest): Promise<ProviderStreamResult>;
}

export interface LLMChatResponse {
  text: string;
  finishReason?: string;
  usage?: LLMUsage;
  meta: LLMResponseMeta;
}

export interface LLMStreamChunk {
  text: string;
  done?: boolean;
  meta?: Pick<LLMResponseMeta, "provider" | "model">;
}

export interface LLMJSONResponse<T = unknown> {
  data: T;
  rawText: string;
  usage?: LLMUsage;
  meta: LLMResponseMeta;
}

export interface StreamHandle extends AsyncIterable<LLMStreamChunk> {
  completed: Promise<{
    finishReason?: string;
    usage?: LLMUsage;
    meta: Pick<LLMResponseMeta, "provider" | "model">;
  }>;
}

export interface LLMInstance {
  chat(input: ChatInputLike, options?: Omit<ChatInput, "prompt">): Promise<LLMChatResponse>;
  stream(input: ChatInputLike, options?: Omit<ChatInput, "prompt">): Promise<StreamHandle>;
  json<T = unknown>(input: JSONInputLike, options?: Omit<JSONInput, "prompt" | "schema">): Promise<LLMJSONResponse<T>>;
  quick<T = unknown>(input: QuickInputLike, options?: QuickOptions): Promise<QuickResponse<T>>;
  streamToResponse(input: ChatInputLike, response: NodeStreamResponseLike, options?: Omit<ChatInput, "prompt">): Promise<void>;
  withDefaults(defaults: LLMDefaults): LLMInstance;
}
