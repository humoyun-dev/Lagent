export interface PlanStep {
  id: number;
  title: string;
  description: string;
  expected_result: string;
}

export interface CliUx {
  normal_mode: string[];
  verbose_mode: string[];
  error_handling: string[];
}

export interface FutureExtension {
  component: string;
  when_to_add: string;
  reason: string;
}

export interface PlanOutput {
  goal: string;
  analysis: string;
  assumptions: string[];
  steps: PlanStep[];
  cli_ux: CliUx;
  future_extensions: FutureExtension[];
}

export type StreamEventType =
  | "status"
  | "thinking"
  | "response"
  | "done"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: string;
}

export interface PlannerOptions {
  model: string;
  verbose: boolean;
  temperature: number;
  maxTokens: number;
  outputDir: string;
}

export const DEFAULT_OPTIONS: PlannerOptions = {
  model: "deepseek-r1:7b",
  verbose: false,
  temperature: 0.5,
  maxTokens: 2048,
  outputDir: "outputs",
};
