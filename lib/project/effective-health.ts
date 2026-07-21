export type EffectiveProjectHealth = "HEALTHY" | "WARNING" | "CRITICAL";

export type EffectiveProjectHealthReason =
  | "STORED_CRITICAL"
  | "STORED_WARNING"
  | "BUDGET_OVERRUN"
  | "BUDGET_WATCH"
  | "CATEGORY_CRITICAL"
  | "CATEGORY_WATCH"
  | "NEGATIVE_MARGIN"
  | "MARGIN_BELOW_TARGET";

export type EffectiveProjectHealthResult = {
  readonly effectiveHealth: EffectiveProjectHealth;
  readonly healthReasons: readonly EffectiveProjectHealthReason[];
};

export type EffectiveProjectHealthInput = {
  readonly storedHealth: string;
  readonly remainingBudget: number;
  readonly usedPercentage: number;
  readonly categoryStatuses?: readonly string[];
  readonly projectedMarginPercentage?: number | null;
  readonly targetMarginPercentage?: number | null;
};

const REASON_PRIORITY: readonly EffectiveProjectHealthReason[] = [
  "BUDGET_OVERRUN",
  "CATEGORY_CRITICAL",
  "NEGATIVE_MARGIN",
  "STORED_CRITICAL",
  "BUDGET_WATCH",
  "CATEGORY_WATCH",
  "MARGIN_BELOW_TARGET",
  "STORED_WARNING",
];

export function resolveEffectiveProjectHealth(
  input: EffectiveProjectHealthInput,
): EffectiveProjectHealthResult {
  const reasons = new Set<EffectiveProjectHealthReason>();
  const categoryStatuses = input.categoryStatuses ?? [];

  if (input.remainingBudget < 0 || input.usedPercentage > 100) {
    reasons.add("BUDGET_OVERRUN");
  } else if (input.usedPercentage >= 75) {
    reasons.add("BUDGET_WATCH");
  }

  if (categoryStatuses.some((status) => status === "CRITICAL" || status === "OVER_BUDGET")) {
    reasons.add("CATEGORY_CRITICAL");
  } else if (categoryStatuses.some((status) => status === "WATCH")) {
    reasons.add("CATEGORY_WATCH");
  }

  if (typeof input.projectedMarginPercentage === "number" && input.projectedMarginPercentage < 0) {
    reasons.add("NEGATIVE_MARGIN");
  } else if (
    typeof input.projectedMarginPercentage === "number" &&
    typeof input.targetMarginPercentage === "number" &&
    input.projectedMarginPercentage < input.targetMarginPercentage
  ) {
    reasons.add("MARGIN_BELOW_TARGET");
  }

  if (input.storedHealth === "CRITICAL") reasons.add("STORED_CRITICAL");
  if (input.storedHealth === "WARNING") reasons.add("STORED_WARNING");

  const healthReasons = REASON_PRIORITY.filter((reason) => reasons.has(reason));
  const critical = healthReasons.some((reason) =>
    ["BUDGET_OVERRUN", "CATEGORY_CRITICAL", "NEGATIVE_MARGIN", "STORED_CRITICAL"].includes(reason),
  );

  return {
    effectiveHealth: critical ? "CRITICAL" : healthReasons.length > 0 ? "WARNING" : "HEALTHY",
    healthReasons,
  };
}

export function projectHealthLabel(health: EffectiveProjectHealth): string {
  if (health === "CRITICAL") return "Kritis";
  if (health === "WARNING") return "Awas";
  return "Sehat";
}

export function projectHealthReasonLabel(reason: EffectiveProjectHealthReason): string {
  switch (reason) {
    case "BUDGET_OVERRUN":
      return "Budget proyek terlampaui";
    case "CATEGORY_CRITICAL":
      return "Kategori budget kritis";
    case "NEGATIVE_MARGIN":
      return "Margin proyek negatif";
    case "STORED_CRITICAL":
      return "Ditandai kritis oleh tim";
    case "BUDGET_WATCH":
      return "Pemakaian budget mendekati batas";
    case "CATEGORY_WATCH":
      return "Kategori budget perlu diawasi";
    case "MARGIN_BELOW_TARGET":
      return "Margin di bawah target";
    case "STORED_WARNING":
      return "Ditandai perlu perhatian oleh tim";
  }
}
