/**
 * Dynamic token budgeting — adjusts max output tokens based on task complexity.
 *
 * Heuristics:
 *   short / simple question    → 1024
 *   medium task                → 1536
 *   code / architecture task   → 2048
 *   complex multi-step / long  → 3072
 */

// ─── keyword sets (lowercase) ─────────────────────────────────────────────────
const CODE_KEYWORDS = [
  "code",
  "implement",
  "refactor",
  "debug",
  "function",
  "class",
  "api",
  "endpoint",
  "database",
  "migration",
  "schema",
  "query",
  "typescript",
  "javascript",
  "python",
  "rust",
  "golang",
  "java",
  "react",
  "vue",
  "angular",
  "next",
  "express",
  "fastify",
  "docker",
  "kubernetes",
  "ci/cd",
  "deploy",
  "test",
  "jest",
  "bug",
  "fix",
  "error",
  "exception",
  "stack trace",
  "algorithm",
  "data structure",
  "binary",
  "tree",
  "graph",
  "import",
  "export",
  "module",
  "package",
  "dependency",
];

const ARCHITECTURE_KEYWORDS = [
  "architecture",
  "design",
  "system",
  "microservice",
  "monolith",
  "scalable",
  "infrastructure",
  "pipeline",
  "workflow",
  "pattern",
  "solid",
  "clean",
  "hexagonal",
  "event-driven",
  "spec",
  "specification",
  "proposal",
  "rfc",
  "plan",
  "roadmap",
  "strategy",
  "migrate",
];

const LONG_FORM_KEYWORDS = [
  "document",
  "documentation",
  "report",
  "tutorial",
  "guide",
  "explain in detail",
  "step by step",
  "comprehensive",
  "thorough",
  "full",
  "complete",
  "blog",
  "article",
  "write",
  "essay",
];

// ─── complexity tiers ─────────────────────────────────────────────────────────
export type ComplexityTier = "light" | "medium" | "heavy" | "complex";

interface BudgetResult {
  tier: ComplexityTier;
  tokens: number;
  reason: string;
}

const TIER_MAP: Record<ComplexityTier, { tokens: number; label: string }> = {
  light: { tokens: 1024, label: "short task" },
  medium: { tokens: 1536, label: "medium task" },
  heavy: { tokens: 2048, label: "code / architecture" },
  complex: { tokens: 3072, label: "complex multi-step" },
};

// ─── scoring helpers ──────────────────────────────────────────────────────────
function countMatches(text: string, keywords: string[]): number {
  let n = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) n++;
  }
  return n;
}

// ─── main function ────────────────────────────────────────────────────────────
export function estimateTokenBudget(task: string): BudgetResult {
  const lower = task.toLowerCase();
  const wordCount = task.split(/\s+/).filter(Boolean).length;
  const lineCount = task.split("\n").length;

  // score each category
  const codeScore = countMatches(lower, CODE_KEYWORDS);
  const archScore = countMatches(lower, ARCHITECTURE_KEYWORDS);
  const longScore = countMatches(lower, LONG_FORM_KEYWORDS);

  // contains inline code or code blocks?
  const hasCode = /```|`[^`]+`/.test(task);
  const hasListItems = (task.match(/^[\s]*[-*\d.]+\s/gm) ?? []).length;

  // ─── determine tier ─────────
  let tier: ComplexityTier = "light";
  let reason = "short query";

  // Long input itself signals complexity
  if (wordCount > 80 || lineCount > 8) {
    tier = "medium";
    reason = `long input (${wordCount} words, ${lineCount} lines)`;
  }

  // Code-related
  if (codeScore >= 2 || hasCode) {
    tier = "heavy";
    reason = `code-related (${codeScore} keyword${codeScore !== 1 ? "s" : ""}${hasCode ? " + code block" : ""})`;
  }

  // Architecture / design
  if (archScore >= 2) {
    tier = tier === "heavy" ? "complex" : "heavy";
    reason = `architecture (${archScore} keywords)`;
  }

  // Long-form document
  if (longScore >= 2) {
    tier = "complex";
    reason = `long-form request (${longScore} keywords)`;
  }

  // Multi-step explicit signals
  if (hasListItems >= 4 || (codeScore >= 2 && archScore >= 1)) {
    tier = "complex";
    reason = `complex multi-step (code:${codeScore}, arch:${archScore}, list:${hasListItems})`;
  }

  // Very short queries stay light
  if (wordCount <= 8 && codeScore === 0 && archScore === 0 && longScore === 0) {
    tier = "light";
    reason = "short query";
  }

  return {
    tier,
    tokens: TIER_MAP[tier].tokens,
    reason,
  };
}

export function tierLabel(tier: ComplexityTier): string {
  return TIER_MAP[tier].label;
}
