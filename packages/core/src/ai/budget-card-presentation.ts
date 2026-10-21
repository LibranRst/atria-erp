import type { ProjectBudgetCategory } from "./tool-output";

/** Number of safe categories shown alongside every category needing attention. */
const SAFE_CONTEXT_ROWS = 2;

function urgencyRank(category: ProjectBudgetCategory): number {
  if (category.status === "OVER_BUDGET" || category.remaining.amount < 0) return 0;
  if (category.status === "CRITICAL") return 1;
  if (category.status === "WATCH") return 2;
  return 3;
}

function needsAttention(category: ProjectBudgetCategory): boolean {
  return urgencyRank(category) < 3;
}

/** Shared selection keeps factual narration aligned with the actual card rows. */
export function selectVisibleBudgetCategories(categories: readonly ProjectBudgetCategory[]): {
  readonly shown: readonly ProjectBudgetCategory[];
  readonly hidden: readonly ProjectBudgetCategory[];
} {
  const sorted = [...categories].sort((left, right) => {
    const rank = urgencyRank(left) - urgencyRank(right);
    return rank !== 0 ? rank : right.usedPercentage - left.usedPercentage;
  });

  const attention = sorted.filter(needsAttention);
  const calm = sorted.filter((category) => !needsAttention(category));
  const shown = [...attention, ...calm.slice(0, SAFE_CONTEXT_ROWS)];

  return { shown, hidden: calm.slice(SAFE_CONTEXT_ROWS) };
}
