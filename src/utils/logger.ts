import chalk from "chalk";

export function log(verbose: boolean, label: string, message: string): void {
  if (!verbose) return;
  console.log(chalk.dim(`[DEBUG] ${label}: ${message}`));
}
