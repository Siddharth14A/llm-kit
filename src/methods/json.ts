import { parseJsonFromText } from "../json/parse.js";
import type { JSONSchemaLike } from "../types.js";

export function parseJsonOutput<T = unknown>(rawText: string, schema?: JSONSchemaLike): { data: T; parseStrategy: string } {
  const parsed = parseJsonFromText<T>(rawText, { schema });
  return {
    data: parsed.data,
    parseStrategy: parsed.parseStrategy,
  };
}
