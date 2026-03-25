# ⚡ llm-kit

**Production-ready LLM infrastructure with a tiny API.**

Stop rewriting:

* streaming logic
* JSON parsing
* retries & fallbacks
* provider switching

Just do:

```bash
npm install @siddharth-aylapuram/llm-kit
```

```ts
import { createLLM } from "@siddharth-aylapuram/llm-kit";

const llm = createLLM({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4.1-mini",
});

await llm.quick("Extract name and age from: John is 25");
```

---

## 💣 Why llm-kit?

* 🔌 Works with **OpenAI, Gemini, Ollama**
* ⚡ Built-in **streaming**
* 🧾 Built-in **JSON extraction**
* 🔁 Built-in **fallback + retry**
* 🧠 Built-in **memory**
* 🧩 Same API across all providers

> Write once. Switch providers anytime.

---

## 🚀 Quick Start

```ts
import { createLLM } from "@siddharth-aylapuram/llm-kit";

const llm = createLLM({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4.1-mini",
});

const result = await llm.chat("Explain vector databases simply.");
console.log(result.text);
```

---

## ⚡ The API

### Chat

```ts
await llm.chat("Explain OAuth simply");
```

---

### Streaming

```ts
const stream = await llm.stream("Write a tweet");

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

---

### Structured JSON

```ts
const result = await llm.json({
  prompt: "Extract name and age from: Sarah is 31 years old.",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  },
});

console.log(result.data);
```

---

### ⚡ Zero-thinking mode

```ts
await llm.quick("Extract invoice data");
```

---

## 🔁 Fallbacks (production-ready)

```ts
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
```

> If one provider fails → automatically switches.

---

## 🧠 Memory

```ts
await llm.chat("My name is Sid.", { sessionId: "user-1" });
await llm.chat("What is my name?", { sessionId: "user-1" });
```

---

## 🧪 Debug Mode

```ts
createLLM({
  ...config,
  debug: true,
});
```

Logs:

* provider used
* fallback triggered
* latency
* token usage

---

## ⚡ Express (1 line streaming)

```ts
app.post("/ai", async (req, res) => {
  await llm.streamToResponse(req.body.prompt, res);
});
```

---

## 🔌 Providers

### OpenAI / Compatible

```ts
createLLM({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4.1-mini",
});
```

### Gemini

```ts
createLLM({
  provider: "gemini",
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-2.5-flash",
});
```

### Ollama (local)

```ts
createLLM({
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.1",
});
```

---

## 📦 Response Shape

```ts
{
  text: string,
  usage: { inputTokens, outputTokens, totalTokens },
  meta: { provider, model, latencyMs, fallbackUsed }
}
```

---

## 🧠 Philosophy

Most LLM SDKs are:

* over-engineered
* inconsistent
* provider-locked

**llm-kit is different:**

> Small API. Strong defaults. Production-ready.

---

## 📌 Roadmap

* Additional providers
* Tool calling primitives
* Advanced schema validation
* Observability hooks

---

## ⭐ Support

If this saved you time, give it a star ⭐
