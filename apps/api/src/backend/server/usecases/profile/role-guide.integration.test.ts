import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@backend/db";
import { role, rolePermission, user, userRoleGuideState } from "@backend/db/schema";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import type { Actor } from "@backend/server/actor";
import { roleGuideRepository } from "./role-guide-repository";
import { roleGuideContextKey } from "./role-guide-context";
import { getOwnRoleGuideUseCase, acknowledgeOwnRoleGuideUseCase } from "./role-guide";

describeIntegration("role-guide PostgreSQL receipt and live permission checks", () => {
  test("migration, own-user isolation, idempotency, live revocation and inactive account guard", async () => {
    const roleId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();
    await db.insert(role).values({ id: roleId, name: `role_guide_${roleId}`, dataScope: "GLOBAL" });
    const actor: Actor = {
      userId,
      roleId,
      roleName: `ROLE_GUIDE_${roleId}`.toUpperCase(),
      permissions: ["view:ledger", "view:budget"],
      dataScope: "GLOBAL",
      name: "Guide QA",
      email: `${userId}@example.invalid`,
      isActive: true,
      mustChangePassword: false,
      sessionId: "qa-session",
      developerActorUserId: null,
    };
    try {
      await db
        .insert(rolePermission)
        .values(actor.permissions.map((permissionKey) => ({ roleId, permissionKey })));
      await db.insert(user).values([
        { id: userId, roleId, name: actor.name, email: actor.email },
        {
          id: otherUserId,
          roleId,
          name: "Other Guide QA",
          email: `${otherUserId}@example.invalid`,
        },
      ]);
      const first = await getOwnRoleGuideUseCase(actor, roleGuideRepository);
      expect(first.success && first.data.shouldAutoShow).toBe(true);
      const input = { contextKey: roleGuideContextKey(actor) };
      expect(
        (await acknowledgeOwnRoleGuideUseCase(actor, input, roleGuideRepository)).success,
      ).toBe(true);
      const [receipt] = await db
        .select()
        .from(userRoleGuideState)
        .where(eq(userRoleGuideState.userId, userId));
      expect(receipt?.contextKey).toBe(input.contextKey);
      await acknowledgeOwnRoleGuideUseCase(actor, input, roleGuideRepository);
      const [again] = await db
        .select()
        .from(userRoleGuideState)
        .where(eq(userRoleGuideState.userId, userId));
      expect(again?.acknowledgedAt).toEqual(receipt?.acknowledgedAt);
      expect(await roleGuideRepository.readAcknowledgedContext(otherUserId)).toBeNull();
      const laptop = await getOwnRoleGuideUseCase(
        { ...actor, sessionId: "qa-laptop" },
        roleGuideRepository,
      );
      expect(laptop.success && laptop.data.shouldAutoShow).toBe(false);

      await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));
      const stale = await acknowledgeOwnRoleGuideUseCase(actor, input, roleGuideRepository);
      expect(!stale.success && stale.error.code).toBe("CONFLICT");
      const revoked = { ...actor, permissions: [] };
      const changed = await getOwnRoleGuideUseCase(revoked, roleGuideRepository);
      expect(changed.success && changed.data.shouldAutoShow).toBe(true);
      expect(changed.success && changed.data.primaryAction.href).toBe("/profile");
      const newInput = { contextKey: roleGuideContextKey(revoked) };
      expect(
        (await acknowledgeOwnRoleGuideUseCase(revoked, newInput, roleGuideRepository)).success,
      ).toBe(true);
      await db.update(user).set({ isActive: false }).where(eq(user.id, userId));
      expect(
        (await acknowledgeOwnRoleGuideUseCase(revoked, newInput, roleGuideRepository)).success,
      ).toBe(false);
    } finally {
      await db.delete(user).where(eq(user.id, userId));
      await db.delete(user).where(eq(user.id, otherUserId));
      await db.delete(role).where(eq(role.id, roleId));
    }
    expect(await roleGuideRepository.readAcknowledgedContext(userId)).toBeNull();
  });
});
