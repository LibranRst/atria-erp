import { getOrganizationSetupOverviewUseCase } from "@backend/server/usecases/onboarding/organization-setup-overview";
import { resolveActor } from "@backend/server/actor";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function getOrganizationSetupOverview(): Promise<
  ActionResponse<OrganizationSetupOverview>
> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  return getOrganizationSetupOverviewUseCase(actor);
}
