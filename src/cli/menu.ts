import { select, input, confirm, Separator } from "@inquirer/prompts";
import chalk from "chalk";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import { fetchLocalModels, formatModelSize } from "./ollama-models.js";

// ─── Planner settings submenu ─────────────────────────────────────────────────
async function plannerSettingsMenu(settings: Settings): Promise<Settings> {
  console.log("");
  console.log(chalk.bold.cyan("  ⚙  Planner Settings"));
  console.log(chalk.dim("  ─────────────────────────────"));

  // Fetch available models
  let modelChoices: Array<{ name: string; value: string }> = [];
  try {
    const models = await fetchLocalModels();
    modelChoices = models.map((m) => ({
      name: `${chalk.white(m.name)} ${chalk.dim(formatModelSize(m.size))}`,
      value: m.name,
    }));
  } catch {
    console.log(
      chalk.yellow("  ⚠  Could not fetch models from Ollama — is it running?"),
    );
    modelChoices = [
      {
        name: settings.planner.model + " (current)",
        value: settings.planner.model,
      },
    ];
  }

  const model = await select({
    message: "Planner model:",
    choices: modelChoices,
    default: settings.planner.model,
    pageSize: 10,
  });

  const temperatureRaw = await input({
    message: "Temperature (0.0 – 1.0):",
    default: String(settings.planner.temperature),
    validate: (v: string) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 0 && n <= 1
        ? true
        : "Enter a number between 0.0 and 1.0";
    },
  });

  const maxTokensRaw = await input({
    message: "Max tokens:",
    default: String(settings.planner.maxTokens),
    validate: (v: string) => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n > 0 ? true : "Enter a positive number";
    },
  });

  const verbose = await confirm({
    message: "Verbose mode (show thinking text):",
    default: settings.planner.verbose,
  });

  const updated: Settings = {
    ...settings,
    planner: {
      model,
      temperature: parseFloat(temperatureRaw),
      maxTokens: parseInt(maxTokensRaw, 10),
      verbose,
    },
  };

  await saveSettings(updated);

  console.log("");
  console.log(chalk.green("  ✓ Settings saved"));
  console.log("");

  return updated;
}

// ─── Main settings menu ───────────────────────────────────────────────────────
export async function settingsMenu(settings: Settings): Promise<Settings> {
  let current = settings;

  while (true) {
    console.log("");
    console.log(chalk.bold.white("  ⚙   Settings"));
    console.log(chalk.dim("  ─────────────────────────────"));
    console.log(
      chalk.dim("  Planner model: ") +
        chalk.cyan(current.planner.model) +
        chalk.dim("  │  temp: ") +
        chalk.white(String(current.planner.temperature)) +
        chalk.dim("  │  max tokens: ") +
        chalk.white(String(current.planner.maxTokens)),
    );
    console.log("");

    const choice = await select({
      message: "Settings menu:",
      choices: [
        {
          name: "Planner  —  model, temperature, max tokens",
          value: "planner",
        },
        new Separator(),
        { name: "Back", value: "back" },
      ],
    });

    if (choice === "planner") {
      current = await plannerSettingsMenu(current);
    } else {
      break;
    }
  }

  return current;
}

// ─── Current settings summary ─────────────────────────────────────────────────
export function printSettingsSummary(settings: Settings): void {
  console.log(
    chalk.dim("  model: ") +
      chalk.cyan(settings.planner.model) +
      chalk.dim("  │  temp: ") +
      chalk.white(String(settings.planner.temperature)) +
      chalk.dim("  │  verbose: ") +
      (settings.planner.verbose ? chalk.green("on") : chalk.dim("off")),
  );
}
