import type {
  JSONInputLike,
  JSONSchemaLike,
  LLMChatResponse,
  LLMConfig,
  LLMJSONResponse,
  LLMMessage,
  LLMMethodOptions,
  LLMResponseMeta,
  NormalizedLLMRequest,
  ProviderStreamResult,
  StreamHandle,
} from "../types.js";

export interface StreamExecutionResult {
  stream: ProviderStreamResult;
  meta: Pick<LLMResponseMeta, "provider" | "model">;
}

export interface MethodRuntime {
  config: LLMConfig;
  executeChat(request: NormalizedLLMRequest): Promise<LLMChatResponse>;
  executeStream(request: NormalizedLLMRequest): Promise<StreamExecutionResult>;
  extractJSON?<T>(rawText: string, schema?: JSONSchemaLike): Promise<{ data: T; parseStrategy?: string }> | { data: T; parseStrategy?: string };
  loadSessionMessages?(sessionId: string): Promise<LLMMessage[] | undefined> | LLMMessage[] | undefined;
  saveSessionMessages?(sessionId: string, messages: LLMMessage[]): Promise<void> | void;
}

export interface NormalizedMethodInput extends LLMMethodOptions {
  prompt: string;
}

export interface NormalizedJSONMethodInput<TSchema = JSONSchemaLike> extends NormalizedMethodInput {
  schema?: TSchema;
}

export type ChatMethod = (input: string | NormalizedMethodInput, options?: Omit<NormalizedMethodInput, "prompt">) => Promise<LLMChatResponse>;

export type StreamMethod = (input: string | NormalizedMethodInput, options?: Omit<NormalizedMethodInput, "prompt">) => Promise<StreamHandle>;

export type JSONMethod = <T = unknown>(
  input: JSONInputLike,
  options?: Omit<NormalizedJSONMethodInput, "prompt" | "schema">,
) => Promise<LLMJSONResponse<T>>;

export interface MethodSuite {
  chat: ChatMethod;
  stream: StreamMethod;
  json: JSONMethod;
}

export interface BuildConversationResult {
  prompt: string;
  system?: string;
  messages: LLMMessage[];
  sessionId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface JSONPromptResult {
  prompt: string;
  system?: string;
  messages: LLMMessage[];
  schema?: JSONSchemaLike;
  sessionId?: string;
  temperature?: number;
  maxTokens?: number;
}
