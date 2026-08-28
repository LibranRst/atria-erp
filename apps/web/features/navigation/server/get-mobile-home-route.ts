import { actorHasPermission } from "@atria/core/auth/permissions";
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
  if (actorHasPermission(actor.roleName, "manage:onboarding")) {
    const onboarding = await getOwnerOnboardingOverviewUseCase({
      id: actor.userId,
      roleId: actor.roleId,
    });
    if (onboarding.success && shouldRedirectToOwnerOnboarding(onboarding.data)) {
      return { route: "/onboarding", onboardingStep: onboarding.data.state.currentStep };
    }
    return { route: "/ledger", onboardingStep: null };
  }

  if (actorHasPermission(actor.roleName, "review:onboarding")) {
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

  /*
   * Tangga tujuan: buku kas dulu, lalu proyek, lalu gudang. Peran tanpa
   * ketiganya mendarat di daftar proyek — halaman paling tidak berbahaya.
   */
  if (actorHasPermission(actor.roleName, "view:ledger")) {
    return { route: "/ledger", onboardingStep: null };
  }
  if (actorHasPermission(actor.roleName, "view:project")) {
    return { route: "/projects", onboardingStep: null };
  }
  if (actorHasPermission(actor.roleName, "view:inventory")) {
    return { route: "/materials", onboardingStep: null };
  }
  return { route: "/projects", onboardingStep: null };
}
