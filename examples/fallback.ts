import { createLLM } from "../src/index.js";

async function main(): Promise<void> {
  const llm = createLLM({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
    fallback: [
      {
        provider: "gemini",
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-2.5-flash",
      },
      {
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "llama3.1",
      },
    ],
  });

  const result = await llm.chat("Summarize the benefits of using retries and fallbacks.");
  console.log(result.text);
  console.log(result.meta);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
