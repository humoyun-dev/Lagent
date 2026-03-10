import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

export interface Settings {
  planner: {
    model: string;
    temperature: number;
    maxTokens: number;
    verbose: boolean;
  };
}

const CONFIG_DIR = join(homedir(), ".config", "planner-agent");
const CONFIG_FILE = join(CONFIG_DIR, "settings.json");

export const DEFAULT_SETTINGS: Settings = {
  planner: {
    model: "deepseek-r1:7b",
    temperature: 0.5,
    maxTokens: 2048,
    verbose: false,
  },
};

export async function loadSettings(): Promise<Settings> {
  if (!existsSync(CONFIG_FILE)) return structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      planner: { ...DEFAULT_SETTINGS.planner, ...parsed.planner },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(settings, null, 2), "utf-8");
}
