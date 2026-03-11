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

export function renderWarning(message: string): void {
  if (thinkingActive) {
    process.stdout.write("\r\x1b[K");
    thinkingActive = false;
  }
  console.log(chalk.yellow("  ⚠ ") + chalk.yellow(message));
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

  // Summary
  console.log("");
  console.log(pad(chalk.bold.dim("SUMMARY")));
  console.log(pad(chalk.white(wrap(plan.summary, w - 4))));

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
    const label = chalk.green.bold(step.id.padStart(7, " ") + " ");
    console.log(pad(label + chalk.bold.white(step.title)));
    console.log(
      pad(
        "         " +
          chalk.white(
            wrap(step.description, w - 11).replace(
              /\n/g,
              "\n" + " ".repeat(11),
            ),
          ),
      ),
    );
    if (verbose && step.reason) {
      console.log(pad("         " + chalk.dim("reason: " + step.reason)));
    }
    if (step.files.length > 0) {
      console.log(
        pad(
          "         " +
            chalk.dim("files: ") +
            chalk.cyan(step.files.join(", ")),
        ),
      );
    }
    if (step.dependencies.length > 0) {
      console.log(
        pad(
          "         " +
            chalk.dim("deps: ") +
            chalk.dim(step.dependencies.join(", ")),
        ),
      );
    }
    console.log(pad("         " + chalk.dim("→ " + step.expected_output)));
    console.log("");
  }

  // Risks
  if (plan.risks.length > 0) {
    console.log(hr());
    console.log("");
    console.log(pad(chalk.bold.dim("RISKS")));
    for (const risk of plan.risks) {
      const levelColor =
        risk.level === "high"
          ? chalk.red
          : risk.level === "medium"
            ? chalk.yellow
            : chalk.green;
      console.log(
        pad(
          chalk.dim("  • ") +
            levelColor(`[${risk.level}]`) +
            " " +
            chalk.white(risk.message),
        ),
      );
    }
    console.log("");
  }

  // Acceptance criteria
  if (plan.acceptance_criteria.length > 0) {
    console.log(hr());
    console.log("");
    console.log(pad(chalk.bold.dim("ACCEPTANCE CRITERIA")));
    for (const c of plan.acceptance_criteria) {
      console.log(pad(chalk.dim("  ✓ ") + chalk.white(c)));
    }
    console.log("");
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
