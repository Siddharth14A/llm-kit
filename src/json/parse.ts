import { LLMInputError, LLMJSONParseError } from "../errors.js";
import type { JSONSchemaLike } from "../types.js";
import { LLMJSONSchemaError, assertJsonSchema } from "./schema.js";

export type JsonParseStrategy =
  | "direct"
  | "code-fence:json"
  | "code-fence:generic"
  | "balanced-scan"
  | "sanitized:trailing-commas";

export interface JsonCandidate {
  text: string;
  strategy: JsonParseStrategy;
}

export interface JsonParseResult<T = unknown> {
  data: T;
  rawText: string;
  parseStrategy: JsonParseStrategy;
}

export interface ParseJsonOptions {
  schema?: JSONSchemaLike;
}

export function normalizeJsonText(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

export function extractJsonCandidates(rawText: string): JsonCandidate[] {
  const text = normalizeJsonText(rawText);
  const candidates: JsonCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (candidate: string, strategy: JsonParseStrategy) => {
    const normalized = normalizeJsonText(candidate);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push({ text: normalized, strategy });
  };

  addCandidate(text, "direct");

  for (const block of extractCodeFenceBlocks(text)) {
    addCandidate(block.body, block.strategy);
  }

  for (const balanced of extractBalancedCandidates(text)) {
    addCandidate(balanced, "balanced-scan");
  }

  return candidates;
}

export function extractJsonCandidate(rawText: string): JsonCandidate | null {
  return extractJsonCandidates(rawText)[0] ?? null;
}

export function safeJsonParse<T = unknown>(candidate: string): { value: T; strategy: JsonParseStrategy } {
  const normalized = normalizeJsonText(candidate);

  if (!normalized) {
    throw new LLMInputError("Unable to parse an empty JSON candidate.");
  }

  try {
    return { value: JSON.parse(normalized) as T, strategy: "direct" };
  } catch (error) {
    const sanitized = sanitizeLooseJson(normalized);
    if (sanitized !== normalized) {
      try {
        return {
          value: JSON.parse(sanitized) as T,
          strategy: "sanitized:trailing-commas",
        };
      } catch (sanitizedError) {
        throw buildJsonParseError(candidate, "sanitized:trailing-commas", sanitizedError);
      }
    }

    throw buildJsonParseError(candidate, "direct", error);
  }
}

export function parseJsonFromText<T = unknown>(rawText: string, options: ParseJsonOptions = {}): JsonParseResult<T> {
  const candidates = extractJsonCandidates(rawText);
  let lastParseError: unknown;
  let lastValidationError: unknown;

  for (const candidate of candidates) {
    try {
      const parsed = safeJsonParse<T>(candidate.text);
      if (options.schema) {
        assertJsonSchema(parsed.value, options.schema);
      }

      return {
        data: parsed.value,
        rawText,
        parseStrategy: candidate.strategy === "direct" ? parsed.strategy : candidate.strategy,
      };
    } catch (error) {
      if (error instanceof LLMJSONSchemaError) {
        lastValidationError = error;
      } else {
        lastParseError = error;
      }
    }
  }

  if (lastValidationError) {
    throw lastValidationError;
  }

  throw buildJsonParseError(rawText, candidates[0]?.strategy ?? "direct", lastParseError);
}

export function parseAndValidateJson<T = unknown>(rawText: string, options: ParseJsonOptions = {}): JsonParseResult<T> {
  return parseJsonFromText<T>(rawText, options);
}

function extractCodeFenceBlocks(text: string): Array<{ body: string; strategy: JsonParseStrategy }> {
  const blocks: Array<{ body: string; strategy: JsonParseStrategy }> = [];
  const fenceRe = /```([^\n`]*)\r?\n([\s\S]*?)```/g;

  for (const match of text.matchAll(fenceRe)) {
    const info = match[1].trim().toLowerCase();
    const body = match[2];
    blocks.push({
      body,
      strategy: info.includes("json") ? "code-fence:json" : "code-fence:generic",
    });
  }

  return blocks;
}

function extractBalancedCandidates(text: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    if (current !== "{" && current !== "[") {
      continue;
    }

    const candidate = scanBalancedJson(text, index);
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    candidates.push(candidate);
  }

  return candidates;
}

function scanBalancedJson(text: string, startIndex: number): string | null {
  const closingStack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const current = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (current === "\\") {
        escaped = true;
        continue;
      }

      if (current === '"') {
        inString = false;
      }

      continue;
    }

    if (current === '"') {
      inString = true;
      continue;
    }

    if (current === "{") {
      closingStack.push("}");
      continue;
    }

    if (current === "[") {
      closingStack.push("]");
      continue;
    }

    if (current === "}" || current === "]") {
      const expected = closingStack.pop();
      if (!expected || expected !== current) {
        return null;
      }

      if (closingStack.length === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function sanitizeLooseJson(candidate: string): string {
  return candidate
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\u0000/g, "")
    .trim();
}

function buildJsonParseError(rawText: string, parseStrategy: JsonParseStrategy, cause: unknown): LLMJSONParseError {
  return new LLMJSONParseError("Failed to recover valid JSON from model output", rawText, {
    parseStrategy,
    cause,
  });
}
