#!/usr/bin/env node

import chalk from "chalk";
import { parseArgs } from "./args.js";
import { runPlanner } from "../core/planner.js";
import { loadSettings } from "./settings.js";
import { startRepl } from "./repl.js";
import type { PlannerOptions } from "../core/types.js";
import type { Settings } from "./settings.js";

function settingsToOptions(s: Settings): PlannerOptions {
  return {
    model: s.planner.model,
    temperature: s.planner.temperature,
    maxTokens: s.planner.maxTokens,
    verbose: s.planner.verbose,
    outputDir: "outputs",
  };
}

async function main(): Promise<void> {
  const { task: argTask, options: argOptions } = parseArgs(process.argv);
  const settings = await loadSettings();

  if (argTask) {
    // Direct task mode — skip REPL (e.g. `npm start -- "build a snake game"`)
    const merged: PlannerOptions = {
      ...settingsToOptions(settings),
      ...argOptions,
    };
    const plan = await runPlanner(argTask, merged);
    if (!plan) process.exitCode = 1;
    return;
  }

  await startRepl(settings);
}

main().catch((err) => {
  console.error(chalk.red("Fatal error:"), err);
  process.exitCode = 1;
});
