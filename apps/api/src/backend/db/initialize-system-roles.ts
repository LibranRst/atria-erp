import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import type { db } from "@backend/db";
import { role, rolePermission } from "@backend/db/schema";

export type SystemRoleInitializationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/** Initialize defaults inside the caller's serialized first-owner transaction. */
export async function initializeSystemRolesTx(
  tx: SystemRoleInitializationTransaction,
): Promise<void> {
  const previousUser = await tx.query.user.findFirst({ columns: { id: true } });
  const createdRoles = await tx
    .insert(role)
    .values([...SYSTEM_ROLES])
    .onConflictDoNothing()
    .returning({ id: role.id });
  const createdRoleIds = new Set(createdRoles.map((createdRole) => createdRole.id));
  const storedGrants = await tx.query.rolePermission.findMany({
    columns: { roleId: true },
  });
  const initializedRoleIds = new Set(storedGrants.map((grant) => grant.roleId));
  // Reset removes permission rows as well as roles. Initialize new roles and
  // empty role scaffolding before the first user; preserve configured grants
  // and intentional revocations in installations that already have users.
  const initialPermissions = SYSTEM_ROLES.filter(
    (systemRole) =>
      createdRoleIds.has(systemRole.id) ||
      (!previousUser && !initializedRoleIds.has(systemRole.id)),
  ).flatMap((systemRole) =>
    (ROLE_PERMISSIONS[systemRole.name.toUpperCase()] ?? []).map((permissionKey) => ({
      roleId: systemRole.id,
      permissionKey,
    })),
  );
  if (initialPermissions.length > 0) {
    await tx.insert(rolePermission).values(initialPermissions).onConflictDoNothing();
  }
}
