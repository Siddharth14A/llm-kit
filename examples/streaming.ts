import { createLLM } from "../src/index.js";

async function main(): Promise<void> {
  const llm = createLLM({
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3.1",
  });

  const stream = await llm.stream("Write a short welcome email for new users.");

  for await (const chunk of stream) {
    process.stdout.write(chunk.text);
  }

  const final = await stream.completed;
  console.log("\n", final.meta);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
