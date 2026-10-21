import type { WebRpcResult } from "@atria/api/contract";
import { canUseTemporaryPasswordDuringDeveloperSimulation } from "@atria/core/auth/developer-account-simulation";
export { safeAdminReturnTo } from "../navigation/paths";

export type AdminActor = NonNullable<WebRpcResult<"server/actor.resolveActor">>;
export type AdminAccessDecision = "login" | "password" | "restricted" | "allowed";

export function adminAccessDecision(input: {
  readonly actor: Pick<
    AdminActor,
    "isActive" | "mustChangePassword" | "permissions" | "roleId" | "developerActorUserId"
  > | null;
  readonly allowPasswordChange?: boolean;
  readonly simulationEnabled?: boolean;
}): AdminAccessDecision {
  const actor = input.actor;
  if (!actor || !actor.isActive) return "login";
  const simulationAllowsPassword = canUseTemporaryPasswordDuringDeveloperSimulation({
    simulationEnabled: input.simulationEnabled ?? false,
    developerActorUserId: actor.developerActorUserId,
    effectiveRoleId: actor.roleId,
  });
  if (actor.mustChangePassword && !input.allowPasswordChange && !simulationAllowsPassword)
    return "password";
  return actor.permissions.includes("use:desktop_admin") ? "allowed" : "restricted";
}
