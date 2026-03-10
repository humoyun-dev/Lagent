import { z } from "zod";

// Coerce a single string into a one-element array so the model can return either
const stringOrArray = z.union([
  z.array(z.string()),
  z.string().transform((s) => [s]),
]);

export const PlanStepSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  expected_result: z.string(),
});

export const CliUxSchema = z.object({
  normal_mode: stringOrArray,
  verbose_mode: stringOrArray,
  error_handling: stringOrArray,
});

export const FutureExtensionSchema = z.object({
  component: z.string(),
  when_to_add: z.string(),
  reason: z.string(),
});

export const PlanOutputSchema = z.object({
  goal: z.string(),
  analysis: z.string(),
  assumptions: z.union([z.array(z.string()), z.string().transform((s) => [s])]),
  steps: z.array(PlanStepSchema).min(1),
  cli_ux: CliUxSchema.optional().default({
    normal_mode: [],
    verbose_mode: [],
    error_handling: [],
  }),
  future_extensions: z.array(FutureExtensionSchema).optional().default([]),
});
