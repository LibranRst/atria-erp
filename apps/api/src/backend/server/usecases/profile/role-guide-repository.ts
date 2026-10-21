import { eq } from "drizzle-orm";
import { db } from "@backend/db";
import { role, rolePermission, user, userRoleGuideState } from "@backend/db/schema";
import { getAllCatalogPermissionKeys } from "@atria/core/auth/permission-catalog";
import { resolveHomeDestinationInfo } from "@backend/features/navigation/server/home-destination";
import type { RoleGuideRepository } from "./role-guide";
import { roleGuideContextKey } from "./role-guide-context";

export const roleGuideRepository: RoleGuideRepository = {
  async readAcknowledgedContext(userId): Promise<string | null> {
    const [state] = await db
      .select({ contextKey: userRoleGuideState.contextKey })
      .from(userRoleGuideState)
      .where(eq(userRoleGuideState.userId, userId));
    return state?.contextKey ?? null;
  },
  async needsOwnerQuickStart(actor): Promise<boolean> {
    if (!actor.permissions.includes("manage:onboarding")) return false;
    return (await resolveHomeDestinationInfo(actor)).route === "/onboarding";
  },
  async acknowledgeCurrentContext(
    actor,
    contextKey,
  ): Promise<"acknowledged" | "stale" | "unavailable"> {
    return db.transaction(async (tx) => {
      // Re-read access under locks: a late acknowledgment must not overwrite a changed role.
      const [currentUser] = await tx
        .select()
        .from(user)
        .where(eq(user.id, actor.userId))
        .for("update");
      if (!currentUser?.isActive || currentUser.mustChangePassword) return "unavailable";
      const [currentRole] = await tx
        .select()
        .from(role)
        .where(eq(role.id, currentUser.roleId))
        .for("share");
      if (!currentRole) return "unavailable";
      const grants = await tx
        .select({ key: rolePermission.permissionKey })
        .from(rolePermission)
        .where(eq(rolePermission.roleId, currentRole.id));
      const held = new Set(grants.map((grant) => grant.key));
      const currentKey = roleGuideContextKey({
        roleId: currentRole.id,
        roleName: currentRole.name.toUpperCase(),
        dataScope:
          currentRole.dataScope === "GLOBAL" || currentRole.dataScope === "ASSIGNED"
            ? currentRole.dataScope
            : "NONE",
        permissions: getAllCatalogPermissionKeys().filter((key) => held.has(key)),
      });
      if (currentKey !== contextKey) return "stale";
      const [existing] = await tx
        .select()
        .from(userRoleGuideState)
        .where(eq(userRoleGuideState.userId, actor.userId));
      if (existing?.contextKey === contextKey) return "acknowledged";
      await tx
        .insert(userRoleGuideState)
        .values({ userId: actor.userId, contextKey })
        .onConflictDoUpdate({
          target: userRoleGuideState.userId,
          set: { contextKey, acknowledgedAt: new Date() },
        });
      return "acknowledged";
    });
  },
};
