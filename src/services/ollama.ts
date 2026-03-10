import { Readable } from "node:stream";

const OLLAMA_URL = process.env["OLLAMA_URL"] || "http://localhost:11434";

export interface OllamaRequestOptions {
  temperature: number;
  maxTokens: number;
}

export async function* requestOllamaStream(
  model: string,
  prompt: string,
  options: OllamaRequestOptions,
): AsyncGenerator<string> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      think: true,
      keep_alive: 0,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama request failed: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  const reader = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream,
  );

  for await (const chunk of reader) {
    yield chunk.toString();
  }
}
