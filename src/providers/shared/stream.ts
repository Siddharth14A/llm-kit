const textDecoder = new TextDecoder();

export async function* iterateResponseLines(body: ReadableStream<Uint8Array> | null | undefined): AsyncGenerator<string> {
  if (!body) {
    return;
  }

  const reader = body.getReader();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += textDecoder.decode(value, { stream: true });

      let lineBreakIndex = buffer.indexOf("\n");
      while (lineBreakIndex >= 0) {
        const line = buffer.slice(0, lineBreakIndex).replace(/\r$/, "");
        buffer = buffer.slice(lineBreakIndex + 1);
        yield line;
        lineBreakIndex = buffer.indexOf("\n");
      }
    }

    const finalChunk = buffer + textDecoder.decode();
    if (finalChunk.trim().length > 0) {
      yield finalChunk.replace(/\r$/, "");
    }
  } finally {
    reader.releaseLock();
  }
}

export function extractSseData(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) {
    return undefined;
  }

  if (trimmed === "data: [DONE]") {
    return "[DONE]";
  }

  if (trimmed.startsWith("data:")) {
    return trimmed.slice(5).trimStart();
  }

  return trimmed;
}

export function parseJsonLine<T = unknown>(line: string): T | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}
