import { describe, expect, it } from "vitest";
import { LLMJSONParseError } from "../../src/errors.js";
import { parseAndValidateJson, parseJsonFromText, safeJsonParse } from "../../src/json/parse.js";
import { LLMJSONSchemaError } from "../../src/json/schema.js";

describe("JSON recovery", () => {
  it("parses plain JSON directly", () => {
    const result = parseJsonFromText('{"name":"Sid","age":31}');

    expect(result.data).toEqual({ name: "Sid", age: 31 });
    expect(result.parseStrategy).toBe("direct");
  });

  it("recovers JSON from fenced output with trailing commas", () => {
    const result = parseJsonFromText([
      "Here you go:",
      "```json",
      '{',
      '  "name": "Sid",',
      '  "age": 31,',
      "}",
      "```",
    ].join("\n"));

    expect(result.data).toEqual({ name: "Sid", age: 31 });
    expect(result.parseStrategy).toBe("code-fence:json");
  });

  it("recovers balanced JSON from surrounding text", () => {
    const result = parseJsonFromText('prefix {"items":[1,2,3],"ok":true} suffix');

    expect(result.data).toEqual({ items: [1, 2, 3], ok: true });
    expect(result.parseStrategy).toBe("balanced-scan");
  });

  it("sanitizes loose JSON in safe parsing", () => {
    const parsed = safeJsonParse('{"ok":true,}');

    expect(parsed.value).toEqual({ ok: true });
    expect(parsed.strategy).toBe("sanitized:trailing-commas");
  });

  it("validates against a basic schema", () => {
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        age: { type: "number" as const },
      },
      required: ["name", "age"],
      additionalProperties: false,
    };

    const result = parseAndValidateJson('{"name":"Sid","age":31}', { schema });
    expect(result.data).toEqual({ name: "Sid", age: 31 });
  });

  it("throws a schema error when required fields are missing", () => {
    const schema = {
      type: "object" as const,
      required: ["name"],
    };

    expect(() => parseAndValidateJson('{"age":31}', { schema })).toThrow(LLMJSONSchemaError);
  });

  it("throws a parse error when recovery fails", () => {
    expect(() => parseJsonFromText("not json at all")).toThrow(LLMJSONParseError);
  });
});
