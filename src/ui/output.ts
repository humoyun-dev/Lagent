import chalk from "chalk";
import type { PlanOutput } from "../core/types.js";

/**
 * Formats a plan summary as a compact one-line string.
 */
export function formatPlanSummary(plan: PlanOutput): string {
  return `${chalk.bold(plan.goal)} — ${plan.steps.length} steps, ${plan.risks.length} risks`;
}
