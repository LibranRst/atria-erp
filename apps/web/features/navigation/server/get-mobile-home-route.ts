import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appConfig, inventoryOpeningBatch } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { getOwnerOnboardingOverviewUseCase } from "@/server/usecases/onboarding/owner-onboarding-overview";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
  shouldRedirectToOwnerOnboarding,
  type OnboardingStepId,
} from "@atria/core/onboarding/owner-onboarding";

export type MobileHomeRoute = {
  readonly route: "/ledger" | "/materials" | "/onboarding" | "/onboarding/review" | "/projects";
  readonly onboardingStep: OnboardingStepId | null;
};

export async function getMobileHomeRoute(actor: Actor): Promise<MobileHomeRoute> {
  if (actor.roleName === "OWNER") {
    const onboarding = await getOwnerOnboardingOverviewUseCase({
      id: actor.userId,
      roleId: actor.roleId,
    });
    if (onboarding.success && shouldRedirectToOwnerOnboarding(onboarding.data)) {
      return { route: "/onboarding", onboardingStep: onboarding.data.state.currentStep };
    }
    return { route: "/ledger", onboardingStep: null };
  }

  if (actor.roleName === "FINANCE_ADMIN") {
    const [stateRow, pending] = await Promise.all([
      db.query.appConfig.findFirst({
        where: eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY),
        columns: { value: true },
      }),
      db.query.inventoryOpeningBatch.findFirst({
        where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
        columns: { id: true },
      }),
    ]);
    if (parseOwnerOnboardingState(stateRow?.value)?.status !== "COMPLETED" && pending) {
      return { route: "/onboarding/review", onboardingStep: null };
    }
    return { route: "/ledger", onboardingStep: null };
  }

  if (actor.roleName === "PURCHASING") {
    return { route: "/materials", onboardingStep: null };
  }
  return { route: "/projects", onboardingStep: null };
}
