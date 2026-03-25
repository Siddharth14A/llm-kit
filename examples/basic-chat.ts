import { createLLM } from "../src/index.js";

async function main(): Promise<void> {
  const llm = createLLM({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
  });

  const result = await llm.chat("Explain vector databases in one paragraph.");
  console.log(result.text);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
