import { createHash } from "node:crypto";
import { serializeRoleGuideContext, type RoleGuideAccess } from "@atria/core/onboarding/role-guide";

export function roleGuideContextKey(access: RoleGuideAccess): string {
  return createHash("sha256").update(serializeRoleGuideContext(access)).digest("hex");
}
