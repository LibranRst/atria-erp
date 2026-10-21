import type { OwnRoleGuide, AcknowledgeRoleGuideInput } from "@atria/core/onboarding/role-guide";
import type { ActionResponse } from "@atria/core/types/action-response";
import { resolveActor } from "@backend/server/actor";
import {
  getOwnRoleGuideUseCase,
  acknowledgeOwnRoleGuideUseCase,
  type RoleGuideAcknowledgment,
} from "@backend/server/usecases/profile/role-guide";
import { roleGuideRepository } from "@backend/server/usecases/profile/role-guide-repository";

export async function getOwnRoleGuide(): Promise<ActionResponse<OwnRoleGuide>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return getOwnRoleGuideUseCase(actor, roleGuideRepository);
}

export async function acknowledgeOwnRoleGuide(
  input: AcknowledgeRoleGuideInput,
): Promise<ActionResponse<RoleGuideAcknowledgment>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return acknowledgeOwnRoleGuideUseCase(actor, input, roleGuideRepository);
}
