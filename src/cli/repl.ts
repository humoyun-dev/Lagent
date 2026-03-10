import { emitKeypressEvents } from "node:readline";
import { cwd } from "node:process";
import { homedir } from "node:os";
import chalk from "chalk";
import boxen from "boxen";
import { saveSettings, type Settings } from "./settings.js";
import { fetchLocalModels, formatModelSize } from "./ollama-models.js";
import { runPlanner } from "../core/planner.js";
import { estimateTokenBudget, tierLabel } from "../core/token-budget.js";
import type { PlannerOptions } from "../core/types.js";

const VERSION = "1.0.0";

interface Cmd {
  cmd: string;
  desc: string;
}
// All commands — used for raw-mode autocomplete suggestions
const COMMANDS: Cmd[] = [
  { cmd: "/model", desc: "choose planning model" },
  { cmd: "/verbose", desc: "toggle verbose thinking output" },
  { cmd: "/settings", desc: "temperature · max tokens" },
  { cmd: "/help", desc: "list all commands" },
  { cmd: "/exit", desc: "quit" },
];

// Options shown in the interactive select menu (triggered by bare `/`)
const MENU_CHOICES = [
  {
    name: chalk.cyan("/model") + "    " + chalk.dim("choose planning model"),
    value: "/model",
  },
  {
    name:
      chalk.cyan("/verbose") +
      "  " +
      chalk.dim("toggle verbose thinking output"),
    value: "/verbose",
  },
  {
    name: chalk.cyan("/settings") + " " + chalk.dim("temperature · max tokens"),
    value: "/settings",
  },
  {
    name: chalk.cyan("/help") + "     " + chalk.dim("list all commands"),
    value: "/help",
  },
  { name: chalk.red("/exit") + "     " + chalk.dim("quit"), value: "/exit" },
];

// ─── session context ──────────────────────────────────────────────────────────
const session = {
  tasksRun: 0,
  lastTask: null as string | null,
  history: [] as string[],
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function friendlyDir(): string {
  const d = cwd();
  const h = homedir();
  return d.startsWith(h) ? "~" + d.slice(h.length) : d;
}

function settingsToOptions(s: Settings): PlannerOptions {
  return {
    model: s.planner.model,
    temperature: s.planner.temperature,
    maxTokens: s.planner.maxTokens,
    verbose: s.planner.verbose,
    outputDir: "outputs",
  };
}

// ─── header ───────────────────────────────────────────────────────────────────
function printHeader(settings: Settings): void {
  const ctxLine =
    session.lastTask != null
      ? chalk.dim("  context:   ") +
        chalk.italic.dim(`"${session.lastTask.slice(0, 55)}"`) +
        chalk.dim(
          `   ${session.tasksRun} plan${session.tasksRun !== 1 ? "s" : ""}`,
        )
      : chalk.dim("  context:   type a task below to get started");

  const lines = [
    chalk.bold.cyan("  🧠  AI Planner") + chalk.dim(`  (v${VERSION})`),
    "",
    chalk.dim("  model:     ") +
      chalk.white(settings.planner.model) +
      chalk.dim("   temperature: ") +
      chalk.white(String(settings.planner.temperature)) +
      chalk.dim("   verbose: ") +
      (settings.planner.verbose ? chalk.green("on") : chalk.dim("off")),
    chalk.dim("  directory: ") + chalk.dim(friendlyDir()),
    ctxLine,
  ];

  process.stdout.write(
    "\n" +
      boxen(lines.join("\n"), {
        padding: { top: 0, bottom: 0, left: 0, right: 1 },
        margin: { top: 0, bottom: 0, left: 1, right: 0 },
        borderColor: "gray",
        borderStyle: "round",
      }) +
      "\n",
  );
}

function printHelp(): void {
  const pad = Math.max(...COMMANDS.map((c) => c.cmd.length)) + 2;
  process.stdout.write("\n");
  for (const { cmd, desc } of COMMANDS) {
    process.stdout.write(
      chalk.cyan("  " + cmd.padEnd(pad)) + chalk.dim(desc) + "\n",
    );
  }
  process.stdout.write("\n");
}

// ─── shared raw-mode primitives ───────────────────────────────────────────────
interface KeyInfo {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  sequence?: string;
}

function rawListen(
  onKey: (str: string | undefined, key: KeyInfo) => void,
): () => void {
  emitKeypressEvents(process.stdin);
  (process.stdin as NodeJS.ReadStream).setRawMode(true);
  process.stdin.resume();
  process.stdin.on("keypress", onKey);
  return () => {
    process.stdin.removeListener("keypress", onKey);
    (process.stdin as NodeJS.ReadStream).setRawMode(false);
    process.stdin.pause();
  };
}

async function rawSelect<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>,
  defaultValue?: T,
): Promise<T> {
  return new Promise((resolve) => {
    const w = (s: string) => process.stdout.write(s);
    let idx = defaultValue
      ? Math.max(
          choices.findIndex((c) => c.value === defaultValue),
          0,
        )
      : 0;
    let rendered = false;

    const render = () => {
      if (rendered) w(`\x1b[${choices.length + 1}A`);
      w(`\r\x1b[K${chalk.bold.cyan("?")} ${chalk.bold(message)}\n`);
      for (let i = 0; i < choices.length; i++) {
        const on = i === idx;
        w(`\r\x1b[K  ${on ? chalk.cyan("❯ ") : "  "}${choices[i]!.name}\n`);
      }
      rendered = true;
    };

    render();

    const cleanup = rawListen((_str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(0);
      }
      if (key.name === "up") {
        idx = (idx - 1 + choices.length) % choices.length;
        render();
        return;
      }
      if (key.name === "down") {
        idx = (idx + 1) % choices.length;
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(choices[idx]!.value);
      }
    });
  });
}

async function rawConfirm(
  message: string,
  defaultVal: boolean,
): Promise<boolean> {
  return new Promise((resolve) => {
    const hint = defaultVal
      ? chalk.bold("Y") + chalk.dim("/n")
      : chalk.dim("y/") + chalk.bold("N");
    process.stdout.write(
      `${chalk.bold.cyan("?")} ${chalk.bold(message)} ${chalk.dim("(")}${hint}${chalk.dim(")")} `,
    );

    const cleanup = rawListen((str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(0);
      }
      if (key.name === "return" || key.name === "enter") {
        process.stdout.write(chalk.dim(defaultVal ? "yes" : "no") + "\n");
        cleanup();
        resolve(defaultVal);
        return;
      }
      const ch = str?.toLowerCase();
      if (ch === "y") {
        process.stdout.write(chalk.green("yes\n"));
        cleanup();
        resolve(true);
        return;
      }
      if (ch === "n") {
        process.stdout.write(chalk.dim("no\n"));
        cleanup();
        resolve(false);
        return;
      }
    });
  });
}

async function rawInput(
  message: string,
  defaultVal?: string,
  validate?: (v: string) => true | string,
): Promise<string> {
  return new Promise((resolve) => {
    const w = (s: string) => process.stdout.write(s);
    let buf = "";
    let errMsg = "";

    const render = () => {
      w(`\r\x1b[K${chalk.bold.cyan("?")} ${chalk.bold(message)} `);
      if (defaultVal && buf === "") w(chalk.dim(`(${defaultVal}) `));
      w(buf);
      if (errMsg) w(chalk.red(` ← ${errMsg}`));
    };

    render();

    const cleanup = rawListen((str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(0);
      }
      if (key.name === "return" || key.name === "enter") {
        const val = buf.trim() === "" ? (defaultVal ?? "") : buf.trim();
        if (validate) {
          const result = validate(val);
          if (result !== true) {
            errMsg = result;
            render();
            return;
          }
        }
        w("\n");
        cleanup();
        resolve(val);
        return;
      }
      if (key.name === "backspace") {
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          render();
        }
        return;
      }
      if (key.name === "escape") {
        buf = "";
        errMsg = "";
        render();
        return;
      }
      if (str && !key.ctrl && !key.meta && str.length === 1) {
        buf += str;
        errMsg = "";
        render();
      }
    });
  });
}

// ─── raw-mode input with live autocomplete ────────────────────────────────────
const PROMPT = chalk.cyan("›") + "  ";

async function readInput(): Promise<string | null> {
  const isTTY = (process.stdin as NodeJS.ReadStream).isTTY ?? false;

  // Non-TTY fallback (piped input, CI, etc.)
  if (!isTTY) {
    return new Promise<string | null>((resolve) => {
      process.stdout.write(PROMPT);
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.resume();
      process.stdin.once("data", (chunk: Buffer | string) => {
        const line = chunk.toString().split("\n")[0] ?? "";
        process.stdin.pause();
        resolve(line.trim() || null);
      });
      process.stdin.once("end", () => resolve(null));
    });
  }

  return new Promise<string | null>((resolve) => {
    const w = (s: string) => process.stdout.write(s);
    let buf = "";
    let suggCount = 0;
    let histIdx = -1;

    emitKeypressEvents(process.stdin);
    (process.stdin as NodeJS.ReadStream).setRawMode(true);
    process.stdin.resume();

    // ── suggestion helpers ───
    const clearSugg = (): void => {
      if (suggCount === 0) return;
      for (let i = 0; i < suggCount; i++) w("\x1b[1B\r\x1b[K");
      w(`\x1b[${suggCount}A`);
      suggCount = 0;
    };

    const showSugg = (): void => {
      clearSugg();
      if (!buf.startsWith("/")) return;
      const matches = COMMANDS.filter((c) => c.cmd.startsWith(buf));
      if (matches.length === 0) return;
      for (const m of matches) {
        const rest = m.cmd.slice(buf.length);
        w(
          `\x1b[1B\r\x1b[K  ${chalk.cyan(buf)}${chalk.bold.dim(rest)}` +
            "  " +
            chalk.dim(m.desc),
        );
      }
      // return cursor to prompt line and reposition after buffer
      w(`\x1b[${matches.length}A\r${PROMPT}${buf}`);
      suggCount = matches.length;
    };

    const redraw = (): void => {
      w(`\r\x1b[K${PROMPT}${buf}`);
      showSugg();
    };

    // initial prompt
    w(PROMPT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onKey = (str: string | undefined, key: KeyInfo): void => {
      if (!key) return;

      // Ctrl-C / Ctrl-D
      if (key.ctrl && key.name === "c") {
        clearSugg();
        w("\n");
        cleanup();
        process.exit(0);
      }
      if (key.ctrl && key.name === "d") {
        clearSugg();
        w("\n");
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        clearSugg();
        w("\n");
        cleanup();
        resolve(buf.trim() === "" ? null : buf.trim());
        return;
      }

      if (key.name === "backspace") {
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          redraw();
        }
        return;
      }

      if (key.name === "escape") {
        clearSugg();
        buf = "";
        histIdx = -1;
        w(`\r\x1b[K${PROMPT}`);
        return;
      }

      // Tab → complete first match
      if (key.name === "tab") {
        const matches = COMMANDS.filter((c) => c.cmd.startsWith(buf));
        if (matches.length >= 1 && matches[0]) {
          clearSugg();
          buf = matches[0].cmd;
          w(`\r\x1b[K${PROMPT}${buf}`);
          showSugg();
        }
        return;
      }

      // Up arrow → history
      if (key.name === "up") {
        if (session.history.length === 0) return;
        histIdx = Math.min(histIdx + 1, session.history.length - 1);
        buf = session.history[histIdx] ?? "";
        redraw();
        return;
      }

      // Down arrow → history
      if (key.name === "down") {
        histIdx = Math.max(histIdx - 1, -1);
        buf = histIdx === -1 ? "" : (session.history[histIdx] ?? "");
        redraw();
        return;
      }

      // Regular printable character
      if (str && !key.ctrl && !key.meta && str.length === 1) {
        buf += str;
        redraw();
      }
    };

    process.stdin.on("keypress", onKey);

    function cleanup(): void {
      process.stdin.off("keypress", onKey);
      (process.stdin as NodeJS.ReadStream).setRawMode(false);
      process.stdin.pause();
    }
  });
}

// ─── command handlers ─────────────────────────────────────────────────────────
async function handleModel(settings: Settings): Promise<Settings> {
  let choices: Array<{ name: string; value: string }> = [];
  try {
    const models = await fetchLocalModels();
    choices = models.map((m) => ({
      name: m.name + "  " + chalk.dim(formatModelSize(m.size)),
      value: m.name,
    }));
  } catch {
    console.log(
      chalk.yellow("\n  ⚠  Could not reach Ollama — is it running?\n"),
    );
    return settings;
  }
  const model = await rawSelect(
    "Choose planning model:",
    choices,
    settings.planner.model,
  );
  const updated = { ...settings, planner: { ...settings.planner, model } };
  await saveSettings(updated);
  console.log(chalk.green(`\n  ✓ Model → ${chalk.bold(model)}\n`));
  return updated;
}

async function handleSettings(settings: Settings): Promise<Settings> {
  const tempRaw = await rawInput(
    "Temperature (0.0 – 1.0):",
    String(settings.planner.temperature),
    (v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 0 && n <= 1 ? true : "Enter 0.0 – 1.0";
    },
  );
  const tokensRaw = await rawInput(
    "Max tokens:",
    String(settings.planner.maxTokens),
    (v) => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n > 0 ? true : "Enter a positive integer";
    },
  );
  const updated = {
    ...settings,
    planner: {
      ...settings.planner,
      temperature: parseFloat(tempRaw),
      maxTokens: parseInt(tokensRaw, 10),
    },
  };
  await saveSettings(updated);
  console.log(chalk.green("\n  ✓ Settings saved\n"));
  return updated;
}

async function handleVerbose(settings: Settings): Promise<Settings> {
  const verbose = await rawConfirm(
    "Enable verbose mode?",
    settings.planner.verbose,
  );
  const updated = { ...settings, planner: { ...settings.planner, verbose } };
  await saveSettings(updated);
  console.log(chalk.green(`\n  ✓ Verbose ${verbose ? "on" : "off"}\n`));
  return updated;
}

// ─── REPL entry point ─────────────────────────────────────────────────────────
export async function startRepl(initialSettings: Settings): Promise<void> {
  let settings = initialSettings;

  printHeader(settings);

  while (true) {
    const line = await readInput();

    if (line === null) {
      process.stdout.write(chalk.dim("\n  Goodbye!\n\n"));
      break;
    }

    session.history.unshift(line);
    if (session.history.length > 50) session.history.pop();

    if (!line.startsWith("/")) {
      const budget = estimateTokenBudget(line);
      process.stdout.write(
        "\n" +
          chalk.dim(
            `  ◆ tokens: ${budget.tokens}  (${tierLabel(budget.tier)})`,
          ) +
          "\n\n",
      );
      await runPlanner(line, settingsToOptions(settings));
      session.tasksRun++;
      session.lastTask = line;
      printHeader(settings);
      continue;
    }

    let cmd = (line.split(/\s+/)[0] ?? "").toLowerCase();

    // bare `/` → interactive select menu
    if (cmd === "/") {
      process.stdout.write("\n");
      cmd = await rawSelect("Choose an action:", MENU_CHOICES);
      process.stdout.write("\n");
    }

    switch (cmd) {
      case "/model":
        settings = await handleModel(settings);
        printHeader(settings);
        break;
      case "/settings":
        settings = await handleSettings(settings);
        printHeader(settings);
        break;
      case "/verbose":
        settings = await handleVerbose(settings);
        printHeader(settings);
        break;
      case "/help":
        printHelp();
        break;
      case "/exit":
      case "/quit":
        process.stdout.write(chalk.dim("\n  Goodbye!\n\n"));
        return;
      default:
        process.stdout.write(
          chalk.yellow(`\n  Unknown command: ${chalk.bold(cmd)}\n`) +
            chalk.dim(
              "  Type / and press Enter for the menu, or /help for commands.\n\n",
            ),
        );
    }
  }
}
