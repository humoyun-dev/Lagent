export type RiskLevel = "low" | "medium" | "high";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  reason: string;
  files: string[];
  dependencies: string[];
  expected_output: string;
}

export interface PlanRisk {
  level: RiskLevel;
  message: string;
}

export interface PlanOutput {
  schema_version: string;
  goal: string;
  summary: string;
  assumptions: string[];
  steps: PlanStep[];
  risks: PlanRisk[];
  acceptance_criteria: string[];
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
