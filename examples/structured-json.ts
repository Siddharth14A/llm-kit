import { createLLM } from "../src/index.js";

async function main(): Promise<void> {
  const llm = createLLM({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
  });

  const result = await llm.json({
    prompt: "Extract name, age, and role from: Sarah is 31 and works as a product manager.",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        role: { type: "string" },
      },
      required: ["name", "age", "role"],
      additionalProperties: false,
    },
  });

  console.log(result.data);
  console.log(result.meta.parseStrategy);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
