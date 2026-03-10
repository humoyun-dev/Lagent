import type { PlannerOptions } from "../core/types.js";
import { DEFAULT_OPTIONS } from "../core/types.js";

export interface ParsedArgs {
  task: string | null;
  options: PlannerOptions;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip node + script
  const options = { ...DEFAULT_OPTIONS };
  let task: string | null = null;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--model" || arg === "-m") {
      const next = args[++i];
      if (next) options.model = next;
    } else if (arg === "--temperature" || arg === "-t") {
      const next = args[++i];
      if (next) options.temperature = parseFloat(next);
    } else if (arg === "--max-tokens") {
      const next = args[++i];
      if (next) options.maxTokens = parseInt(next, 10);
    } else if (arg === "--output" || arg === "-o") {
      const next = args[++i];
      if (next) options.outputDir = next;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    task = positional.join(" ");
  }

  return { task, options };
}
