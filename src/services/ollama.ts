import { Readable } from "node:stream";

const OLLAMA_URL = process.env["OLLAMA_URL"] || "http://localhost:11434";
const THINKING_UNSUPPORTED_PATTERNS = [
  /does not support thinking/i,
  /unknown field "think"/i,
  /unrecognized field "think"/i,
  /invalid .*think/i,
];

export interface OllamaRequestOptions {
  temperature: number;
  maxTokens: number;
}

interface OllamaErrorPayload {
  error?: string;
}

function parseOllamaError(text: string): string {
  if (!text.trim()) return "";
  try {
    const parsed = JSON.parse(text) as OllamaErrorPayload;
    return parsed.error?.trim() || text.trim();
  } catch {
    return text.trim();
  }
}

function isThinkingUnsupportedError(status: number, message: string): boolean {
  if (status !== 400) return false;
  return THINKING_UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(message));
}

function formatRequestError(
  status: number,
  statusText: string,
  details: string,
): string {
  const suffix = details ? `: ${details}` : "";
  return `Ollama request failed: ${status} ${statusText}${suffix}`;
}

async function callGenerateEndpoint(
  model: string,
  prompt: string,
  options: OllamaRequestOptions,
  think: boolean,
): Promise<Response> {
  return fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      think,
      keep_alive: 0,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    }),
  });
}

export async function* requestOllamaStream(
  model: string,
  prompt: string,
  options: OllamaRequestOptions,
): AsyncGenerator<string> {
  let response = await callGenerateEndpoint(model, prompt, options, true);

  if (!response.ok) {
    const firstErrorBody = await response.text();
    const firstErrorMessage = parseOllamaError(firstErrorBody);

    if (isThinkingUnsupportedError(response.status, firstErrorMessage)) {
      response = await callGenerateEndpoint(model, prompt, options, false);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      const details = parseOllamaError(errorBody);
      throw new Error(
        formatRequestError(response.status, response.statusText, details),
      );
    }
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
