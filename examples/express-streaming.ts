import { createLLM } from "../src/index.js";

type ExpressLikeRequest = {
  body: {
    prompt?: string;
  };
};

type ExpressLikeResponse = {
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
  status(code: number): ExpressLikeResponse;
  json(payload: unknown): void;
};

const llm = createLLM({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4.1-mini",
});

export async function postChat(req: ExpressLikeRequest, res: ExpressLikeResponse): Promise<void> {
  const prompt = req.body.prompt?.trim();

  if (!prompt) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const stream = await llm.stream(prompt);
  for await (const chunk of stream) {
    res.write(chunk.text);
  }

  res.end();
}
