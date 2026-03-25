import { LLMKitError } from "../errors.js";
import type { JSONSchemaLike } from "../types.js";

export interface JsonValidationIssue {
  path: string;
  message: string;
}

export class LLMJSONSchemaError extends LLMKitError {
  readonly issues: JsonValidationIssue[];

  constructor(message: string, issues: JsonValidationIssue[], cause?: unknown) {
    super(message, { cause });
    this.issues = issues;
  }
}

export function validateJsonValue(value: unknown, schema?: JSONSchemaLike, path = "$"): JsonValidationIssue[] {
  if (!schema) {
    return [];
  }

  const expectedType = schema.type ?? inferSchemaType(schema);
  const issues: JsonValidationIssue[] = [];

  if (schema.enum && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    issues.push({
      path,
      message: `Value at ${path} must match one of the allowed enum values`,
    });
  }

  if (expectedType === "object") {
    if (!isPlainObject(value)) {
      issues.push({ path, message: `Expected object at ${path}` });
      return issues;
    }

    const objectValue = value as Record<string, unknown>;
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in objectValue)) {
        issues.push({ path: `${path}.${key}`, message: `Missing required property "${key}"` });
      }
    }

    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in objectValue) {
          issues.push(...validateJsonValue(objectValue[key], propertySchema, `${path}.${key}`));
        }
      }
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(objectValue)) {
        if (!allowedKeys.has(key)) {
          issues.push({ path: `${path}.${key}`, message: `Unexpected property "${key}"` });
        }
      }
    }

    return issues;
  }

  if (expectedType === "array") {
    if (!Array.isArray(value)) {
      issues.push({ path, message: `Expected array at ${path}` });
      return issues;
    }

    if (schema.items) {
      value.forEach((item, index) => {
        issues.push(...validateJsonValue(item, schema.items, `${path}[${index}]`));
      });
    }

    return issues;
  }

  if (expectedType === "string") {
    if (typeof value !== "string") {
      issues.push({ path, message: `Expected string at ${path}` });
    }
    return issues;
  }

  if (expectedType === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      issues.push({ path, message: `Expected number at ${path}` });
    }
    return issues;
  }

  if (expectedType === "boolean") {
    if (typeof value !== "boolean") {
      issues.push({ path, message: `Expected boolean at ${path}` });
    }
    return issues;
  }

  if (expectedType === "null") {
    if (value !== null) {
      issues.push({ path, message: `Expected null at ${path}` });
    }
    return issues;
  }

  return issues;
}

export function assertJsonSchema(value: unknown, schema?: JSONSchemaLike): void {
  const issues = validateJsonValue(value, schema);
  if (issues.length === 0) {
    return;
  }

  throw new LLMJSONSchemaError(formatValidationMessage(issues), issues);
}

function inferSchemaType(schema: JSONSchemaLike): JSONSchemaLike["type"] | undefined {
  if (schema.properties) {
    return "object";
  }

  if (schema.items) {
    return "array";
  }

  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValidationMessage(issues: JsonValidationIssue[]): string {
  const summary = issues.slice(0, 5).map((issue) => `${issue.path}: ${issue.message}`);
  const more = issues.length > summary.length ? ` and ${issues.length - summary.length} more issue(s)` : "";
  return `JSON schema validation failed: ${summary.join("; ")}${more}`;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left === null || right === null) {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
  }

  return false;
}
