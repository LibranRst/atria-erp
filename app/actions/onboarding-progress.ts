"use server";

import { eq } from "drizzle-orm";

import {
  readPersistedOnboardingState,
  requireOnboardingOwner,
  revalidateOnboardingPaths,
  saveOnboardingState,
  uniqueOnboardingSteps,
} from "@/app/actions/onboarding-action-utils";
import { getOwnerOnboardingOverview } from "@/app/actions/onboarding-overview";
import { db } from "@/db";
import { appConfig, auditLog } from "@/db/schema";
import {
  advanceOwnerOnboardingStepSchema,
  DEFAULT_OWNER_ONBOARDING_STATE,
  nextOnboardingStep,
  OWNER_ONBOARDING_CONFIG_KEY,
  type OnboardingStepId,
  type OwnerOnboardingState,
  parseOwnerOnboardingState,
  pauseOwnerOnboardingSchema,
} from "@/lib/onboarding/owner-onboarding";
import type { ActionResponse } from "@/lib/types/action-response";

export async function advanceOwnerOnboardingStep(input: unknown): Promise<
  ActionResponse<{
    readonly state: OwnerOnboardingState;
    readonly nextStep: OnboardingStepId;
  }>
> {
  const validation = advanceOwnerOnboardingStepSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Step onboarding tidak valid." },
    };
  }
  try {
    const current = await requireOnboardingOwner();
    const destination = nextOnboardingStep(validation.data.stepId);
    const next = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(appConfig)
        .where(eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY))
        .for("update");
      const base = parseOwnerOnboardingState(existing?.value) ?? DEFAULT_OWNER_ONBOARDING_STATE;
      const reviewed =
        validation.data.disposition === "REVIEWED"
          ? uniqueOnboardingSteps([...base.reviewedSteps, validation.data.stepId])
          : base.reviewedSteps.filter((step) => step !== validation.data.stepId);
      const skipped =
        validation.data.disposition === "SKIPPED"
          ? uniqueOnboardingSteps([...base.skippedSteps, validation.data.stepId])
          : base.skippedSteps.filter((step) => step !== validation.data.stepId);
      const state: OwnerOnboardingState = {
        ...base,
        status: "IN_PROGRESS",
        currentStep: destination,
        reviewedSteps: reviewed,
        skippedSteps: skipped,
        completedAt: null,
        initialStockDecision:
          validation.data.stepId === "initial_stock"
            ? (validation.data.initialStockDecision ?? base.initialStockDecision)
            : base.initialStockDecision,
      };
      const value = JSON.stringify(state);
      const [saved] = existing
        ? await tx
            .update(appConfig)
            .set({ value, updatedAt: new Date(), updatedById: current.id })
            .where(eq(appConfig.id, existing.id))
            .returning()
        : await tx
            .insert(appConfig)
            .values({
              key: OWNER_ONBOARDING_CONFIG_KEY,
              value,
              description: "Progress onboarding Owner untuk fondasi operasional Atria.",
              updatedById: current.id,
            })
            .returning();
      await tx.insert(auditLog).values({
        userId: current.id,
        action: "ADVANCE_OWNER_ONBOARDING_STEP",
        targetTable: "app_config",
        targetId: saved.id,
        originalState: existing?.value ?? null,
        newState: JSON.stringify({
          state,
          disposition: validation.data.disposition,
          sourceStep: validation.data.stepId,
          destination,
        }),
      });
      return state;
    });
    revalidateOnboardingPaths();
    return { success: true, data: { state: next, nextStep: destination } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message:
          error instanceof Error && error.message === "FORBIDDEN"
            ? "Hanya Owner yang dapat mengubah onboarding."
            : "Progress onboarding gagal disimpan.",
      },
    };
  }
}

export async function pauseOwnerOnboarding(
  input: unknown,
): Promise<ActionResponse<OwnerOnboardingState>> {
  const validation = pauseOwnerOnboardingSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Step onboarding tidak valid." },
    };
  }
  try {
    const current = await requireOnboardingOwner();
    const persisted = await readPersistedOnboardingState();
    const next: OwnerOnboardingState = {
      ...(persisted.state ?? DEFAULT_OWNER_ONBOARDING_STATE),
      status: "PAUSED",
      currentStep: validation.data.currentStep,
    };
    await saveOnboardingState(current, next, "PAUSE_OWNER_ONBOARDING");
    return { success: true, data: next };
  } catch {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Onboarding tidak dapat dijeda." },
    };
  }
}

export async function completeOwnerOnboarding(): Promise<ActionResponse<OwnerOnboardingState>> {
  try {
    const current = await requireOnboardingOwner();
    const overview = await getOwnerOnboardingOverview();
    if (!overview.success || !overview.data.canComplete) {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: overview.success
            ? `Onboarding belum dapat diselesaikan: ${overview.data.blockers[0]?.detail ?? "masih ada fondasi wajib yang belum siap."}`
            : "Readiness onboarding belum dapat diverifikasi.",
        },
      };
    }
    const persisted = await readPersistedOnboardingState();
    const next: OwnerOnboardingState = {
      ...(persisted.state ?? DEFAULT_OWNER_ONBOARDING_STATE),
      status: "COMPLETED",
      currentStep: "summary",
      completedAt: new Date().toISOString(),
    };
    await saveOnboardingState(current, next, "COMPLETE_OWNER_ONBOARDING");
    return { success: true, data: next };
  } catch {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Onboarding tidak dapat diselesaikan." },
    };
  }
}
