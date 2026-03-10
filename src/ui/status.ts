import chalk from "chalk";

export function formatStatus(message: string): string {
  return chalk.dim(`[STATUS] ${message}`);
}

export function formatSpinner(message: string): string {
  return chalk.cyan(`⏳ ${message}`);
}

export function formatSuccess(message: string): string {
  return chalk.green(`✓ ${message}`);
}

export function formatError(message: string): string {
  return chalk.red(`✗ ${message}`);
}
