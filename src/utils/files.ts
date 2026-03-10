import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlanOutput } from "../core/types.js";

export async function saveOutputs(
  outputDir: string,
  rawResponse: string,
  parsedPlan: PlanOutput | null,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  await writeFile(
    join(outputDir, `raw-response-${timestamp}.json`),
    rawResponse,
    "utf-8",
  );

  if (parsedPlan) {
    await writeFile(
      join(outputDir, `parsed-plan-${timestamp}.json`),
      JSON.stringify(parsedPlan, null, 2),
      "utf-8",
    );
  }
}
