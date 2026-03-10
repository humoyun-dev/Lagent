import type { StreamEvent } from "../core/types.js";

interface OllamaChunk {
  response?: string;
  thinking?: string;
  done?: boolean;
}

/**
 * Parses NDJSON stream chunks from Ollama into structured events.
 * Uses Ollama's native `thinking` field (when think:true is set)
 * and falls back to detecting <think>...</think> tags in response.
 */
export async function* parseStream(
  rawStream: AsyncGenerator<string>,
): AsyncGenerator<StreamEvent> {
  let insideThinkTag = false;
  let thinkTagBuffer = "";

  for await (const chunk of rawStream) {
    const lines = chunk.split("\n").filter(Boolean);

    for (const line of lines) {
      let parsed: OllamaChunk;
      try {
        parsed = JSON.parse(line) as OllamaChunk;
      } catch {
        continue;
      }

      if (parsed.done) {
        // Flush any remaining think-tag buffer
        if (insideThinkTag && thinkTagBuffer) {
          yield { type: "thinking", data: thinkTagBuffer };
          thinkTagBuffer = "";
        }
        yield { type: "done", data: "" };
        return;
      }

      // 1. Native thinking field (Ollama think:true)
      if (parsed.thinking) {
        yield { type: "thinking", data: parsed.thinking };
      }

      // 2. Response field — also check for <think> tags as fallback
      const token = parsed.response ?? "";
      if (!token) continue;

      if (token.includes("<think>")) {
        insideThinkTag = true;
        const after = token.split("<think>")[1] ?? "";
        if (after) thinkTagBuffer += after;
        continue;
      }

      if (token.includes("</think>")) {
        insideThinkTag = false;
        const before = token.split("</think>")[0] ?? "";
        thinkTagBuffer += before;
        if (thinkTagBuffer) {
          yield { type: "thinking", data: thinkTagBuffer };
          thinkTagBuffer = "";
        }
        continue;
      }

      if (insideThinkTag) {
        thinkTagBuffer += token;
        if (thinkTagBuffer.length > 80) {
          yield { type: "thinking", data: thinkTagBuffer };
          thinkTagBuffer = "";
        }
      } else {
        yield { type: "response", data: token };
      }
    }
  }

  yield { type: "done", data: "" };
}
