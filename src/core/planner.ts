import { buildPlannerPrompt } from "./prompt.js";
import { estimateTokenBudget, tierLabel } from "./token-budget.js";
import { requestOllamaStream } from "../services/ollama.js";
import { parseStream } from "../services/stream-parser.js";
import { validatePlanOutput } from "../services/validator.js";
import {
  renderStatus,
  renderSuccess,
  renderThinkingStart,
  renderThinkingToken,
  renderThinkingEnd,
  renderPlan,
  renderError,
} from "../ui/renderer.js";
import { saveOutputs } from "../utils/files.js";
import { log } from "../utils/logger.js";
import type { PlanOutput, PlannerOptions, StreamEvent } from "./types.js";

export async function runPlanner(
  task: string,
  options: PlannerOptions,
): Promise<PlanOutput | null> {
  // 1. Build prompt
  renderStatus("Building prompt...");
  const prompt = buildPlannerPrompt(task);
  log(options.verbose, "Prompt built", prompt.slice(0, 120) + "...");

  // 1.5  Dynamic token budget
  const budget = estimateTokenBudget(task);
  const effectiveTokens = budget.tokens;
  renderStatus(`Token budget: ${effectiveTokens} (${tierLabel(budget.tier)})`);
  log(
    options.verbose,
    "Budget",
    `${budget.tier} → ${effectiveTokens} tokens — ${budget.reason}`,
  );

  // 2. Connect to Ollama
  renderStatus("Connecting to Ollama...");
  let rawStream: AsyncGenerator<string>;
  try {
    rawStream = requestOllamaStream(options.model, prompt, {
      temperature: options.temperature,
      maxTokens: effectiveTokens,
    });
  } catch (err) {
    renderError(
      `Failed to connect to Ollama: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  // 3. Parse stream — show thinking to user
  renderStatus("Receiving response...");
  let fullResponse = "";
  let thinkingActive = false;

  try {
    for await (const event of parseStream(rawStream)) {
      if (event.type === "thinking") {
        if (!thinkingActive) {
          thinkingActive = true;
          renderThinkingStart();
        }
        // show live thinking
        renderThinkingToken(event.data);
      }

      if (event.type === "response") {
        if (thinkingActive) {
          renderThinkingEnd();
          thinkingActive = false;
        }
        fullResponse += event.data;
      }

      if (event.type === "done") {
        if (thinkingActive) {
          renderThinkingEnd();
          thinkingActive = false;
        }
      }

      if (event.type === "error") {
        renderError(event.data);
        return null;
      }
    }
  } catch (err) {
    renderError(
      `Stream error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  // 4. Validate
  renderStatus("Validating plan...");
  const validation = validatePlanOutput(fullResponse);

  if (!validation.success || !validation.data) {
    renderError(`Validation failed:\n${validation.error}`);
    log(options.verbose, "Raw response", fullResponse);
    await saveOutputs(options.outputDir, fullResponse, null);
    return null;
  }

  // 5. Render
  renderPlan(validation.data, options.verbose);

  // 6. Save outputs
  renderStatus("Saving outputs...");
  await saveOutputs(options.outputDir, fullResponse, validation.data);

  renderSuccess("Done ✓");
  return validation.data;
}
