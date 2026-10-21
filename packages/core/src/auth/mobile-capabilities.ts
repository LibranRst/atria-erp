import type { PermissionKey, RoleDataScope } from "./permissions";

/** Hanya akses UI; tidak membawa token, sesi, atau kewenangan dari client. */
export type MobileCapabilities = {
  readonly userId: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly permissions: readonly PermissionKey[];
  readonly dataScope: RoleDataScope;
};

export function selectMobileCapabilities(actor: MobileCapabilities): MobileCapabilities {
  return {
    userId: actor.userId,
    roleId: actor.roleId,
    roleName: actor.roleName,
    permissions: [...actor.permissions],
    dataScope: actor.dataScope,
  };
}
