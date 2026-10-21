import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";

export type AuthCacheIdentity = {
  readonly userId: string | null | undefined;
  readonly sessionId: string | null | undefined;
  readonly roleId: string | null | undefined;
  readonly permissions: readonly PermissionKey[];
  readonly dataScope: RoleDataScope | null;
};

/** A scope downgrade must isolate cached reads even when permissions stay the same. */
export function createAuthCacheScope(identity: AuthCacheIdentity): string {
  return JSON.stringify([
    identity.userId,
    identity.sessionId,
    identity.roleId,
    [...identity.permissions].sort(),
    identity.dataScope,
  ]);
}
