import chalk from "chalk";
import type { PlanOutput } from "../core/types.js";

// ─── terminal width helper ───────────────────────────────────────────────────
const cols = (): number => process.stdout.columns ?? 80;
const hr = (ch = "─"): string => chalk.dim(ch.repeat(cols()));

// ─── thinking state ──────────────────────────────────────────────────────────
let thinkingActive = false;
let thinkingBuffer = "";
let thinkingStart = 0;

// ─── header ──────────────────────────────────────────────────────────────────
export function renderHeader(): void {
  console.log("");
  console.log(hr());
  console.log(
    chalk.bold.cyan("  🧠  AI Planner") +
      chalk.dim("  —  local model, structured output"),
  );
  console.log(hr());
  console.log("");
}

// ─── status ──────────────────────────────────────────────────────────────────
export function renderStatus(message: string): void {
  if (thinkingActive) {
    // clear current thinking line first
    process.stdout.write("\r\x1b[K");
    thinkingActive = false;
  }
  console.log(chalk.cyan("  ◆ ") + chalk.white(message));
}

export function renderSuccess(message: string): void {
  if (thinkingActive) {
    process.stdout.write("\r\x1b[K");
    thinkingActive = false;
  }
  console.log(chalk.green("  ✓ ") + chalk.dim(message));
}

export function renderError(message: string): void {
  if (thinkingActive) {
    process.stdout.write("\r\x1b[K");
    thinkingActive = false;
  }
  console.error("");
  console.error(chalk.red("  ✗ ") + chalk.red.bold(message));
  console.error("");
}

// ─── thinking display ────────────────────────────────────────────────────────
export function renderThinkingStart(): void {
  thinkingActive = true;
  thinkingBuffer = "";
  thinkingStart = Date.now();
  process.stdout.write(chalk.dim("  │ ") + chalk.yellow.dim("…"));
}

export function renderThinkingToken(text: string): void {
  thinkingBuffer += text;

  // get last non-empty line from the buffer
  const lines = thinkingBuffer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const lastLine = lines[lines.length - 1] ?? "";
  const maxLen = cols() - 8; // account for prefix "  │ " and padding
  const display =
    lastLine.length > maxLen
      ? "…" + lastLine.slice(lastLine.length - (maxLen - 1))
      : lastLine;

  process.stdout.write(
    "\r\x1b[K" + chalk.dim("  │ ") + chalk.yellow.dim(display),
  );
}

export function renderThinkingVerbose(_text: string): void {
  // handled by renderThinkingToken
}

export function renderThinkingEnd(): void {
  if (!thinkingActive) return;
  process.stdout.write("\r\x1b[K"); // clear the live line
  const elapsed = ((Date.now() - thinkingStart) / 1000).toFixed(1);
  console.log(
    chalk.green("  ✓ ") +
      chalk.dim(`Thinking complete`) +
      chalk.dim(` (${elapsed}s)`),
  );
  thinkingActive = false;
  thinkingBuffer = "";
}

// ─── plan render ─────────────────────────────────────────────────────────────
export function renderPlan(plan: PlanOutput, verbose: boolean): void {
  const w = Math.min(cols(), 100);
  const pad = (s: string): string => "  " + s;

  console.log("");
  console.log(hr("═"));

  // Goal
  console.log("");
  console.log(pad(chalk.bold.white("🎯  " + plan.goal)));
  console.log("");
  console.log(hr());

  // Analysis
  console.log("");
  console.log(pad(chalk.bold.dim("ANALYSIS")));
  console.log(pad(chalk.white(wrap(plan.analysis, w - 4))));

  // Assumptions
  if (plan.assumptions.length > 0) {
    console.log("");
    console.log(pad(chalk.bold.dim("ASSUMPTIONS")));
    for (const a of plan.assumptions) {
      console.log(pad(chalk.dim("  • ") + chalk.white(a)));
    }
  }

  // Steps
  console.log("");
  console.log(hr());
  console.log("");
  console.log(pad(chalk.bold.dim("STEPS")));
  console.log("");

  for (const step of plan.steps) {
    const num = chalk.green.bold(String(step.id).padStart(2, " ") + " ");
    console.log(pad(num + chalk.bold.white(step.title)));
    console.log(
      pad(
        "     " +
          chalk.white(
            wrap(step.description, w - 9).replace(/\n/g, "\n" + " ".repeat(9)),
          ),
      ),
    );
    console.log(pad("     " + chalk.dim("→ " + step.expected_result)));
    console.log("");
  }

  // Verbose: CLI UX + future extensions
  if (verbose) {
    if (
      plan.cli_ux &&
      (plan.cli_ux.normal_mode.length > 0 ||
        plan.cli_ux.error_handling.length > 0)
    ) {
      console.log(hr());
      console.log("");
      console.log(pad(chalk.bold.dim("CLI UX NOTES")));

      if (plan.cli_ux.normal_mode.length > 0) {
        console.log(pad(chalk.dim("  Normal mode:")));
        for (const s of plan.cli_ux.normal_mode)
          console.log(pad(chalk.dim("    • ") + chalk.white(s)));
      }
      if (plan.cli_ux.verbose_mode.length > 0) {
        console.log(pad(chalk.dim("  Verbose mode:")));
        for (const s of plan.cli_ux.verbose_mode)
          console.log(pad(chalk.dim("    • ") + chalk.white(s)));
      }
      if (plan.cli_ux.error_handling.length > 0) {
        console.log(pad(chalk.dim("  Error handling:")));
        for (const s of plan.cli_ux.error_handling)
          console.log(pad(chalk.dim("    • ") + chalk.white(s)));
      }
      console.log("");
    }

    if (plan.future_extensions && plan.future_extensions.length > 0) {
      console.log(hr());
      console.log("");
      console.log(pad(chalk.bold.dim("FUTURE EXTENSIONS")));
      console.log("");
      for (const ext of plan.future_extensions) {
        console.log(pad(chalk.dim("  ◇ ") + chalk.white.bold(ext.component)));
        console.log(pad(chalk.dim("    When: ") + chalk.dim(ext.when_to_add)));
        console.log(pad(chalk.dim("    Why:  ") + chalk.dim(ext.reason)));
        console.log("");
      }
    }
  }

  console.log(hr("═"));
  console.log("");
}

// ─── word wrap helper ─────────────────────────────────────────────────────────
function wrap(text: string, maxWidth: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}
