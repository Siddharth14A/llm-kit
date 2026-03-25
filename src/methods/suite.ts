import { createChatMethod } from "./chat.js";
import { createJSONMethod } from "./json-method.js";
import { createStreamMethod } from "./stream.js";
import type { MethodRuntime, MethodSuite } from "./types.js";

export function createMethodSuite(runtime: MethodRuntime): MethodSuite {
  return {
    chat: createChatMethod(runtime),
    stream: createStreamMethod(runtime),
    json: createJSONMethod(runtime),
  };
}
