import { LLMInputError } from "../errors.js";
import type { ChatInputLike, JSONInput, LLMMessage } from "../types.js";
import type { BuildConversationResult, JSONPromptResult, NormalizedMethodInput, NormalizedJSONMethodInput } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNormalizedMethodInput(value: unknown): value is NormalizedMethodInput {
  return isRecord(value) && typeof value.prompt === "string";
}

function normalizeMethodFields(
  input: string | NormalizedMethodInput,
  options?: Omit<NormalizedMethodInput, "prompt">,
): NormalizedMethodInput {
  if (typeof input === "string") {
    return {
      ...(options ?? {}),
      prompt: input,
    };
  }

  if (!isNormalizedMethodInput(input)) {
    throw new LLMInputError("Invalid LLM input: expected a prompt string or an object with a prompt property.");
  }

  return {
    ...input,
    ...(options ?? {}),
    prompt: input.prompt,
  };
}

function combineMessages(messages: LLMMessage[] | undefined, system: string | undefined): LLMMessage[] {
  const output = [...(messages ?? [])];
  if (!system) {
    return output;
  }

  if (output.length > 0 && output[0].role === "system") {
    output[0] = { role: "system", content: system };
    return output;
  }

  return [{ role: "system", content: system }, ...output];
}

export function normalizeChatInput(
  input: ChatInputLike,
  options: Omit<NormalizedMethodInput, "prompt"> | undefined,
  defaultSystemPrompt?: string,
): BuildConversationResult {
  const normalized = normalizeMethodFields(input, options);
  const system = normalized.system ?? defaultSystemPrompt;
  const messages = combineMessages(normalized.messages, system);

  return {
    prompt: normalized.prompt,
    system,
    messages: [...messages, { role: "user", content: normalized.prompt }],
    sessionId: normalized.sessionId,
    temperature: normalized.temperature,
    maxTokens: normalized.maxTokens,
  };
}

export function normalizeJSONInput(
  input: string | JSONInput,
  options: Omit<NormalizedJSONMethodInput, "prompt" | "schema"> | undefined,
  defaultSystemPrompt?: string,
): JSONPromptResult {
  const schema = isRecord(input) && "schema" in input ? (input.schema as JSONInput["schema"]) : undefined;
  const normalized = normalizeMethodFields(
    typeof input === "string"
      ? input
      : {
          ...input,
          prompt: input.prompt,
        },
    options,
  );

  const system = normalized.system ?? defaultSystemPrompt;
  const schemaDirective = schema ? `\n\nReturn JSON that matches this schema:\n${JSON.stringify(schema, null, 2)}` : "";
  const jsonSystem = [system, "Respond with valid JSON only. Do not wrap the response in markdown fences.", schemaDirective]
    .filter(Boolean)
    .join("\n\n");

  return {
    prompt: normalized.prompt,
    system: jsonSystem || undefined,
    schema,
    messages: combineMessages(normalized.messages, jsonSystem || undefined).concat({ role: "user", content: normalized.prompt }),
    sessionId: normalized.sessionId,
    temperature: normalized.temperature,
    maxTokens: normalized.maxTokens,
  };
}
