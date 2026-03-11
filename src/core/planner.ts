import { buildPlannerPrompt, buildRepairPrompt } from "./prompt.js";
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
  renderWarning,
} from "../ui/renderer.js";
import { saveOutputs } from "../utils/files.js";
import { log } from "../utils/logger.js";
import type { PlanOutput, PlannerOptions, StreamEvent } from "./types.js";

async function collectStream(
  rawStream: AsyncGenerator<string>,
  options: { showThinking: boolean },
): Promise<string | null> {
  let fullResponse = "";
  let thinkingActive = false;

  try {
    for await (const event of parseStream(rawStream)) {
      if (event.type === "thinking") {
        if (options.showThinking) {
          if (!thinkingActive) {
            thinkingActive = true;
            renderThinkingStart();
          }
          renderThinkingToken(event.data);
        }
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

  return fullResponse;
}

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
  const fullResponse = await collectStream(rawStream, {
    showThinking: true,
  });

  if (fullResponse === null) return null;

  // 4. Validate
  renderStatus("Validating plan...");
  let validation = validatePlanOutput(fullResponse);

  // 4.5 Retry once if validation failed
  if (!validation.success && validation.error) {
    renderWarning(`Validation failed, retrying with repair prompt...`);
    log(options.verbose, "Validation error", validation.error);

    const repairPrompt = buildRepairPrompt(fullResponse, validation.error);

    try {
      const retryStream = requestOllamaStream(options.model, repairPrompt, {
        temperature: 0.2,
        maxTokens: effectiveTokens,
      });

      renderStatus("Receiving corrected response...");
      const retryResponse = await collectStream(retryStream, {
        showThinking: false,
      });

      if (retryResponse !== null) {
        validation = validatePlanOutput(retryResponse);

        if (validation.success) {
          renderSuccess("Repair successful — plan validated on retry");
        } else {
          log(options.verbose, "Retry also failed", validation.error ?? "");
        }
      }
    } catch (err) {
      log(
        options.verbose,
        "Retry failed",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

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
