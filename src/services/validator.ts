import { PlanOutputSchema } from "../core/schemas.js";
import type { PlanOutput } from "../core/types.js";

export interface ValidationResult {
  success: boolean;
  data?: PlanOutput;
  error?: string;
}

/**
 * Extracts JSON from a raw response string.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function extractJson(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // Find first { and last } to extract JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return cleaned;
}

/**
 * Validates raw response text against the PlanOutput schema.
 */
export function validatePlanOutput(raw: string): ValidationResult {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      success: false,
      error: `Invalid JSON: could not parse response.\nRaw (first 200 chars): ${raw.slice(0, 200)}`,
    };
  }

  const result = PlanOutputSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    return {
      success: false,
      error: `Schema validation failed:\n${issues}`,
    };
  }

  return { success: true, data: result.data };
}
