import { z } from "zod";

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  reason: z.string().min(1),
  files: z.array(z.string()),
  dependencies: z.array(z.string()),
  expected_output: z.string().min(1),
});

export const PlanRiskSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  message: z.string().min(1),
});

export const PlanOutputSchema = z.object({
  schema_version: z.string().default("1.0"),
  goal: z.string().min(1),
  summary: z.string().min(1),
  assumptions: z.array(z.string()),
  steps: z.array(PlanStepSchema).min(1),
  risks: z.array(PlanRiskSchema),
  acceptance_criteria: z.array(z.string()).min(1),
});
