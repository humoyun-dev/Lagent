const OLLAMA_URL = process.env["OLLAMA_URL"] ?? "http://localhost:11434";

export interface OllamaModel {
  name: string;
  size: number;
}

export async function fetchLocalModels(): Promise<OllamaModel[]> {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) throw new Error(`Ollama not reachable: ${response.status}`);
  const data = (await response.json()) as {
    models: Array<{ name: string; size: number }>;
  };
  return data.models.map((m) => ({ name: m.name, size: m.size }));
}

export function formatModelSize(bytes: number): string {
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}
