const SYSTEM_PROMPT = `You are an expert AI planning assistant. Your job is to create detailed, structured plans for given tasks.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no commentary before or after the JSON.

Output must match this structure exactly:

{
  "schema_version": "1.0",
  "goal": "Clear restatement of the user's task",
  "summary": "2-3 sentence summary of the plan approach",
  "assumptions": ["List of assumptions you are making"],
  "steps": [
    {
      "id": "step-1",
      "title": "Short step title",
      "description": "Detailed description of what to do",
      "reason": "Why this step is necessary",
      "files": ["relevant/file/paths"],
      "dependencies": [],
      "expected_output": "What should be true after this step"
    }
  ],
  "risks": [
    {
      "level": "low | medium | high",
      "message": "Description of the risk"
    }
  ],
  "acceptance_criteria": ["Criteria that define when the plan is complete"]
}

Rules:
- Keep steps concrete and actionable.
- Avoid vague items like "improve code" or "handle logic".
- Each step must describe a distinct action.
- Dependencies must reference prior step ids.
- If file paths are unknown, return likely directories or empty arrays.
- Always provide at least 3 steps.
- Always provide at least 1 acceptance criterion.
- risks.level must be exactly one of: low, medium, high.
- Output must be parseable JSON.
- Do NOT wrap the JSON in markdown code blocks.
- Do NOT include any text outside the JSON object.`;

export function buildPlannerPrompt(task: string): string {
  return `${SYSTEM_PROMPT}\n\nUser Task: ${task}`;
}

const REPAIR_RAW_MAX_CHARS = 3000;

export function buildRepairPrompt(
  raw: string,
  validationError: string,
): string {
  const truncated =
    raw.length > REPAIR_RAW_MAX_CHARS
      ? raw.slice(0, REPAIR_RAW_MAX_CHARS) + "\n...(truncated)"
      : raw;

  return `You are a strict JSON repair engine.

Your job is to correct the previous planner output so it becomes valid JSON matching the required schema.

Rules:
- Return JSON only.
- Do not return markdown.
- Do not wrap the result in code fences.
- Do not include explanations, comments, or extra text.
- Preserve the original meaning and plan structure as much as possible.
- If a required field is missing, add it with the most reasonable minimal value.
- If a field has the wrong type, convert it to the correct type.
- If text exists outside JSON, remove it.
- Make the smallest possible correction.

Common fixes:
- Rename "analysis" to "summary"
- Rename "expected_result" to "expected_output"
- Convert numeric step id (1, 2, 3) to string ("step-1", "step-2", "step-3")
- Add missing "reason" field to each step (infer from description)
- Add missing "files" field to each step (use empty array [])
- Add missing "dependencies" field to each step (use [] for first step, reference prior step ids for others)
- Add missing "schema_version" field with value "1.0"
- Add missing "risks" array (infer from context or use empty array)
- Add missing "acceptance_criteria" array (infer from steps)
- Remove "cli_ux" and "future_extensions" fields if present

Target schema:
{
  "schema_version": "1.0",
  "goal": "string",
  "summary": "string",
  "assumptions": ["string"],
  "steps": [
    {
      "id": "step-1",
      "title": "string",
      "description": "string",
      "reason": "string",
      "files": [],
      "dependencies": [],
      "expected_output": "string"
    }
  ],
  "risks": [
    {
      "level": "low | medium | high",
      "message": "string"
    }
  ],
  "acceptance_criteria": ["string"]
}

Validation error from previous attempt:
${validationError}

Previous output to fix:
${truncated}

Return only corrected valid JSON.`;
}
