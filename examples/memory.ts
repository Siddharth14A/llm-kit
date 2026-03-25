import { createLLM } from "../src/index.js";

async function main(): Promise<void> {
  const llm = createLLM({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
    memory: true,
  });

  await llm.chat("My name is Sid.", { sessionId: "user-1" });
  const result = await llm.chat("What is my name?", { sessionId: "user-1" });

  console.log(result.text);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
