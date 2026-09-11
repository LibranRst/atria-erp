import { z } from "zod";

import type { OwnerOnboardingState } from "./owner-onboarding";

export const OWNER_ONBOARDING_V2_CONFIG_KEY = "owner_onboarding_v2";

export const QUICK_START_STEP_IDS = [
  "welcome",
  "financial_defaults",
  "first_project",
  "success",
] as const;

export const QUICK_START_WORK_STEP_IDS = ["financial_defaults", "first_project"] as const;

export const quickStartStepIdSchema = z.enum(QUICK_START_STEP_IDS);
export type QuickStartStepId = z.infer<typeof quickStartStepIdSchema>;

export const initialStockDecisionSchema = z.enum([
  "UNDECIDED",
  "NO_LEGACY_STOCK",
  "HAS_LEGACY_STOCK",
  "SKIPPED",
]);
export type InitialStockDecision = z.infer<typeof initialStockDecisionSchema>;

export const ownerQuickStartStateSchema = z.object({
  version: z.literal(2),
  status: z.enum(["IN_PROGRESS", "PAUSED", "COMPLETED"]),
  currentStep: quickStartStepIdSchema,
  reviewedSteps: z.array(quickStartStepIdSchema),
  firstProjectId: z.string().uuid().nullable(),
  initialStockDecision: initialStockDecisionSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type OwnerQuickStartState = z.infer<typeof ownerQuickStartStateSchema>;

/**
 * The persisted workflow position is authoritative for mutations. A stale URL
 * may describe a reviewed step, but rendering it as active would expose a
 * button whose mutation is guaranteed to fail with STALE_QUICK_START_STEP.
 */
export function resolveQuickStartActiveStep(
  state: Pick<OwnerQuickStartState, "currentStep">,
  requestedStep?: QuickStartStepId,
): QuickStartStepId {
  return requestedStep === state.currentStep ? requestedStep : state.currentStep;
}

export function createDefaultOwnerQuickStartState(
  now = new Date().toISOString(),
): OwnerQuickStartState {
  return {
    version: 2,
    status: "IN_PROGRESS",
    currentStep: "welcome",
    reviewedSteps: [],
    firstProjectId: null,
    initialStockDecision: "UNDECIDED",
    startedAt: now,
    completedAt: null,
  };
}

export function parseOwnerQuickStartState(
  value: string | null | undefined,
): OwnerQuickStartState | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = ownerQuickStartStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export type LegacyQuickStartFacts = {
  readonly financeDefaultsReady: boolean;
  readonly hasProject: boolean;
  readonly firstProjectId?: string | null;
  readonly existingInstall?: boolean;
  readonly now?: string;
};

/**
 * Projects that already operated before v2 must never be forced through first-run setup.
 * The mapper is intentionally pure: reading legacy state never writes a new config row.
 */
export function mapLegacyOwnerOnboardingState(
  legacy: OwnerOnboardingState | null,
  facts: LegacyQuickStartFacts,
): OwnerQuickStartState {
  const now = facts.now ?? new Date().toISOString();
  const completed = legacy?.status === "COMPLETED" || facts.hasProject || facts.existingInstall;
  if (completed) {
    return {
      ...createDefaultOwnerQuickStartState(now),
      status: "COMPLETED",
      currentStep: "success",
      reviewedSteps: ["welcome", "financial_defaults", "first_project", "success"],
      firstProjectId: facts.firstProjectId ?? null,
      initialStockDecision: legacy?.initialStockDecision ?? "UNDECIDED",
      completedAt: legacy?.completedAt ?? now,
    };
  }

  const legacyPastWelcome = Boolean(
    legacy && (legacy.currentStep !== "welcome" || legacy.reviewedSteps.includes("welcome")),
  );
  const currentStep: QuickStartStepId = !legacyPastWelcome
    ? "welcome"
    : facts.financeDefaultsReady
      ? "first_project"
      : "financial_defaults";
  const reviewedSteps: QuickStartStepId[] = legacyPastWelcome ? ["welcome"] : [];
  if (currentStep === "first_project") reviewedSteps.push("financial_defaults");

  return {
    ...createDefaultOwnerQuickStartState(now),
    status: legacy?.status === "PAUSED" ? "PAUSED" : "IN_PROGRESS",
    currentStep,
    reviewedSteps,
    initialStockDecision: legacy?.initialStockDecision ?? "UNDECIDED",
  };
}

export type QuickStartProgress = {
  readonly current: number;
  readonly total: number;
  readonly percentage: number;
  readonly label: string;
};

export function getQuickStartProgress(stepId: QuickStartStepId): QuickStartProgress {
  const total = QUICK_START_WORK_STEP_IDS.length;
  if (stepId === "welcome") return { current: 0, total, percentage: 0, label: `${total} tahap` };
  if (stepId === "success")
    return { current: total, total, percentage: 100, label: "Quick start selesai" };
  const current = QUICK_START_WORK_STEP_IDS.indexOf(stepId) + 1;
  return {
    current,
    total,
    percentage: (current / total) * 100,
    label: `${current} dari ${total}`,
  };
}

export const operationalReadinessIdSchema = z.enum([
  "core_team",
  "bank_account",
  "material_foundation",
  "initial_stock",
  "vendor",
  "item_library",
]);
export type OperationalReadinessId = z.infer<typeof operationalReadinessIdSchema>;

export type SetupAction = {
  readonly href: string;
  readonly label: string;
};

export type OperationalReadinessItem = {
  readonly id: OperationalReadinessId;
  readonly label: string;
  readonly detail: string;
  readonly ready: boolean;
  readonly status: "READY" | "INCOMPLETE" | "PENDING_APPROVAL" | "NOT_APPLICABLE";
  readonly action: SetupAction | null;
};

export type OrganizationSetupOverview = {
  readonly canManageQuickStart: boolean;
  readonly hasPersistedState: boolean;
  readonly freshInstall: boolean;
  readonly shouldAutoOpen: boolean;
  readonly quickStart: {
    readonly state: OwnerQuickStartState;
    readonly progress: QuickStartProgress;
  };
  readonly requiredReadiness: readonly OperationalReadinessItem[];
  readonly recommendedReadiness: readonly OperationalReadinessItem[];
  readonly requiredReadyCount: number;
  readonly requiredTotal: number;
  readonly allRequiredReady: boolean;
};

export const advanceQuickStartSchema = z.object({
  stepId: z.enum(["welcome", "financial_defaults"]),
});

export const pauseQuickStartSchema = z.object({
  currentStep: z.enum(["welcome", "financial_defaults", "first_project"]),
});

export const setInitialStockDecisionSchema = z.object({
  decision: z.enum(["NO_LEGACY_STOCK", "HAS_LEGACY_STOCK", "SKIPPED"]),
});

export const createFirstProjectQuickStartSchema = z
  .object({
    name: z.string().trim().min(1, "Nama project wajib diisi."),
    clientId: z.string().uuid().optional(),
    newClientName: z.string().trim().optional(),
    newClientEmail: z.string().trim().optional(),
    newClientPhone: z.string().trim().optional(),
    newClientAddress: z.string().trim().optional(),
    projectManagerId: z.string().uuid().nullable().optional(),
    totalContractValue: z.number().positive("Nilai project harus lebih dari nol."),
    approvedRabValue: z.number().positive("RAB disetujui harus lebih dari nol."),
  })
  .superRefine((value, context) => {
    if (!value.clientId && !value.newClientName) {
      context.addIssue({
        code: "custom",
        message: "Pilih klien atau isi nama klien baru.",
        path: ["newClientName"],
      });
    }
  });

export type CreateFirstProjectQuickStartInput = z.input<typeof createFirstProjectQuickStartSchema>;

export const recordQuickStartInteractionSchema = z.object({
  event: z.literal("RETRY"),
  stepId: quickStartStepIdSchema,
});
