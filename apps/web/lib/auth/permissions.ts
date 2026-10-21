import "server-only";

export type * from "@atria/api/types/lib/auth/permissions";

export {
  ROLE_ID_TO_NAME,
  ROLE_PERMISSIONS,
  resolveStaticRoleName,
} from "@atria/core/auth/permissions";

import type { PermissionKey } from "@atria/core/auth/permissions";
export function actorCan(
  actor: { readonly permissions: readonly PermissionKey[]; readonly isActive?: boolean },
  permission: PermissionKey,
): boolean {
  return actor.isActive !== false && actor.permissions.includes(permission);
}
