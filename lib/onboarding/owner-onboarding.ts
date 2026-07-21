import { z } from "zod";

export const OWNER_ONBOARDING_CONFIG_KEY = "owner_onboarding_v1";

export const ONBOARDING_STEP_IDS = [
  "welcome",
  "financial_defaults",
  "team_vendors",
  "bank_accounts",
  "material_foundation",
  "item_library",
  "initial_stock",
  "summary",
] as const;

export const OWNER_ONBOARDING_SETUP_STEP_IDS = [
  "financial_defaults",
  "team_vendors",
  "bank_accounts",
  "material_foundation",
  "item_library",
  "initial_stock",
] as const;

export const onboardingStepIdSchema = z.enum(ONBOARDING_STEP_IDS);
export type OnboardingStepId = z.infer<typeof onboardingStepIdSchema>;

export type OwnerOnboardingProgress = {
  readonly current: number;
  readonly total: number;
  readonly percentage: number;
  readonly label: string;
};

export function getOwnerOnboardingProgress(stepId: OnboardingStepId): OwnerOnboardingProgress {
  const total = OWNER_ONBOARDING_SETUP_STEP_IDS.length;
  if (stepId === "welcome") {
    return {
      current: 0,
      total,
      percentage: 0,
      label: `${total} langkah setup`,
    };
  }
  if (stepId === "summary") {
    return { current: total, total, percentage: 100, label: "Ringkasan" };
  }

  const current = OWNER_ONBOARDING_SETUP_STEP_IDS.indexOf(stepId) + 1;
  return {
    current,
    total,
    percentage: (current / total) * 100,
    label: `${current} dari ${total}`,
  };
}

export const ownerOnboardingStateSchema = z.object({
  version: z.literal(1),
  status: z.enum(["IN_PROGRESS", "PAUSED", "COMPLETED"]),
  currentStep: onboardingStepIdSchema,
  reviewedSteps: z.array(onboardingStepIdSchema),
  skippedSteps: z.array(onboardingStepIdSchema),
  completedAt: z.string().datetime().nullable(),
  initialStockDecision: z
    .enum(["UNDECIDED", "NO_LEGACY_STOCK", "HAS_LEGACY_STOCK", "SKIPPED"])
    .default("UNDECIDED"),
});

export type OwnerOnboardingState = z.infer<typeof ownerOnboardingStateSchema>;
export type OnboardingStepStatus =
  "READY" | "INCOMPLETE" | "SKIPPED" | "REVIEWED" | "PENDING_APPROVAL" | "NOT_APPLICABLE";

export type OwnerOnboardingReadiness = {
  readonly id: OnboardingStepId;
  readonly label: string;
  readonly detail: string;
  readonly status: OnboardingStepStatus;
  readonly ready: boolean;
  readonly href: string;
};

export type OnboardingReadinessIssue = {
  readonly stepId: OnboardingStepId;
  readonly label: string;
  readonly detail: string;
};

export type OnboardingVerificationFact = {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
};

export type OnboardingVerificationSnapshot = {
  readonly [StepId in Exclude<OnboardingStepId, "summary">]: {
    readonly kind: StepId;
    readonly capturedAt: string;
    readonly status: OnboardingStepStatus;
    readonly title: string;
    readonly facts: readonly OnboardingVerificationFact[];
    readonly technical?: readonly OnboardingVerificationFact[];
  };
}[Exclude<OnboardingStepId, "summary">];

export type OwnerOnboardingOverview = {
  readonly canManageOnboarding: boolean;
  readonly state: OwnerOnboardingState;
  readonly hasPersistedState: boolean;
  readonly freshInstall: boolean;
  readonly shouldAutoOpen: boolean;
  readonly readiness: readonly OwnerOnboardingReadiness[];
  readonly blockers: readonly OnboardingReadinessIssue[];
  readonly warnings: readonly OnboardingReadinessIssue[];
  readonly canComplete: boolean;
  readonly counts: {
    readonly activeUsers: number;
    readonly activeVendors: number;
    readonly activeBankAccounts: number;
    readonly activeLocations: number;
    readonly activeMaterials: number;
    readonly activeLibraryItems: number;
    readonly pendingInitialStockBatches: number;
    readonly postedInitialStockBatches: number;
  };
};

export const advanceOwnerOnboardingStepSchema = z
  .object({
    stepId: onboardingStepIdSchema,
    disposition: z.enum(["REVIEWED", "SKIPPED"]),
    initialStockDecision: z.enum(["NO_LEGACY_STOCK", "HAS_LEGACY_STOCK", "SKIPPED"]).optional(),
  })
  .superRefine((value, context) => {
    if (value.initialStockDecision && value.stepId !== "initial_stock")
      context.addIssue({
        code: "custom",
        message: "Keputusan stok hanya valid pada step saldo awal.",
        path: ["initialStockDecision"],
      });
  });

export const pauseOwnerOnboardingSchema = z.object({
  currentStep: onboardingStepIdSchema,
});

export const DEFAULT_OWNER_ONBOARDING_STATE: OwnerOnboardingState = {
  version: 1,
  status: "IN_PROGRESS",
  currentStep: "welcome",
  reviewedSteps: [],
  skippedSteps: [],
  completedAt: null,
  initialStockDecision: "UNDECIDED",
};

export function parseOwnerOnboardingState(
  value: string | null | undefined,
): OwnerOnboardingState | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = ownerOnboardingStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function nextOnboardingStep(stepId: OnboardingStepId): OnboardingStepId {
  const index = ONBOARDING_STEP_IDS.indexOf(stepId);
  return ONBOARDING_STEP_IDS[Math.min(index + 1, ONBOARDING_STEP_IDS.length - 1)];
}

export type OwnerOnboardingGateInput = {
  readonly financeDefaultsReady: boolean;
  readonly teamReady: boolean;
  readonly bankReady: boolean;
  readonly materialFoundationReady: boolean;
  readonly postedInitialStockBatches: number;
  readonly pendingInitialStockBatches: number;
  readonly rejectedInitialStockBatches: number;
  readonly noLegacyStockConfirmed: boolean;
  readonly vendorReady: boolean;
  readonly itemLibraryReady: boolean;
  readonly initialStockSkipped: boolean;
};

export function deriveOwnerOnboardingGates(input: OwnerOnboardingGateInput): {
  readonly blockers: readonly OnboardingReadinessIssue[];
  readonly warnings: readonly OnboardingReadinessIssue[];
  readonly canComplete: boolean;
} {
  const blockers: OnboardingReadinessIssue[] = [];
  const warnings: OnboardingReadinessIssue[] = [];
  if (!input.financeDefaultsReady)
    blockers.push({
      stepId: "financial_defaults",
      label: "Default finansial belum siap",
      detail: "Aktifkan alokasi budget dan lima kategori biaya canonical.",
    });
  if (!input.teamReady)
    blockers.push({
      stepId: "team_vendors",
      label: "Tim inti belum lengkap",
      detail: "Akun aktif Finance Admin, Project Manager, dan Purchasing wajib tersedia.",
    });
  if (!input.bankReady)
    blockers.push({
      stepId: "bank_accounts",
      label: "Rekening perusahaan belum tersedia",
      detail: "Tambahkan minimal satu rekening aktif.",
    });
  if (!input.materialFoundationReady)
    blockers.push({
      stepId: "material_foundation",
      label: "Fondasi material belum siap",
      detail: "Tambahkan minimal satu lokasi dan satu Material Master aktif.",
    });
  if (input.pendingInitialStockBatches > 0)
    blockers.push({
      stepId: "initial_stock",
      label: "Saldo awal masih menunggu persetujuan",
      detail: "Finance Admin harus memutus semua batch pending sebelum onboarding selesai.",
    });
  const initialStockFinal = input.postedInitialStockBatches > 0 || input.noLegacyStockConfirmed;
  if (!initialStockFinal && input.pendingInitialStockBatches === 0) {
    blockers.push({
      stepId: "initial_stock",
      label:
        input.rejectedInitialStockBatches > 0
          ? "Saldo awal ditolak dan belum diperbaiki"
          : "Keputusan saldo awal belum final",
      detail: input.initialStockSkipped
        ? "Pilihan Isi nanti adalah blocker. Catat stok lama atau nyatakan tidak ada stok lama."
        : "Catat stok lama atau nyatakan secara eksplisit bahwa tidak ada stok lama.",
    });
  }
  if (!input.vendorReady)
    warnings.push({
      stepId: "team_vendors",
      label: "Vendor belum ditambahkan",
      detail: "Opsional saat onboarding dan dapat dilengkapi sebelum transaksi pembelian.",
    });
  if (!input.itemLibraryReady)
    warnings.push({
      stepId: "item_library",
      label: "Library Item & Harga masih kosong",
      detail: "Opsional; template dapat ditambahkan saat mulai menyusun RAP/RAB.",
    });
  return { blockers, warnings, canComplete: blockers.length === 0 };
}

export function shouldRedirectToOwnerOnboarding(
  overview: Pick<OwnerOnboardingOverview, "shouldAutoOpen" | "hasPersistedState" | "state">,
): boolean {
  return (
    overview.shouldAutoOpen ||
    (overview.hasPersistedState && overview.state.status === "IN_PROGRESS")
  );
}
