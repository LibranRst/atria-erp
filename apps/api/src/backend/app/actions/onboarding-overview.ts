import { getOnboardingActor } from "@backend/app/actions/onboarding-action-utils";
import { getOwnerOnboardingOverviewUseCase } from "@backend/server/usecases/onboarding/owner-onboarding-overview";
import type { OwnerOnboardingOverview } from "@atria/core/onboarding/owner-onboarding";
import type { ActionResponse } from "@atria/core/types/action-response";

/**
 * Pembungkus tipis di atas `getOwnerOnboardingOverviewUseCase`.
 *
 * Identitas SELALU diselesaikan di sini dari sesi, tidak pernah diterima
 * sebagai argumen — modul `"use server"` adalah endpoint HTTP, jadi parameter
 * aktor akan bisa dipalsukan klien.
 */
export async function getOwnerOnboardingOverview(): Promise<
  ActionResponse<OwnerOnboardingOverview>
> {
  const actor = await getOnboardingActor();
  return getOwnerOnboardingOverviewUseCase(actor);
}
