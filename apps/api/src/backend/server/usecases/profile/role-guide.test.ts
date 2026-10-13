import { describe, expect, test } from "bun:test";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import type { Actor } from "@backend/server/actor";
import { roleGuideContextKey } from "./role-guide-context";
import {
  getOwnRoleGuideUseCase,
  acknowledgeOwnRoleGuideUseCase,
  type RoleGuideRepository,
} from "./role-guide";

function actor(userId = "alice"): Actor {
  return {
    userId,
    roleId: SYSTEM_ROLES[2].id,
    roleName: "PROJECT_MANAGER",
    name: "PM",
    email: "pm@example.invalid",
    isActive: true,
    mustChangePassword: false,
    sessionId: "session",
    permissions: ROLE_PERMISSIONS.PROJECT_MANAGER ?? [],
    dataScope: "ASSIGNED",
    developerActorUserId: null,
  };
}
function fixture(): {
  readonly repository: RoleGuideRepository;
  readonly receipts: Map<string, string>;
  readonly current: { actor: Actor; needsSetup: boolean; fail: boolean; saves: number };
} {
  const receipts = new Map<string, string>();
  const current = { actor: actor(), needsSetup: false, fail: false, saves: 0 };
  const repository: RoleGuideRepository = {
    async readAcknowledgedContext(userId): Promise<string | null> {
      if (current.fail) throw new Error("offline");
      return receipts.get(userId) ?? null;
    },
    async needsOwnerQuickStart(): Promise<boolean> {
      return current.needsSetup;
    },
    async acknowledgeCurrentContext(caller, key): Promise<"acknowledged" | "stale"> {
      if (current.fail) throw new Error("offline");
      if (key !== roleGuideContextKey(current.actor)) return "stale";
      if (receipts.get(caller.userId) !== key) {
        receipts.set(caller.userId, key);
        current.saves += 1;
      }
      return "acknowledged";
    },
  };
  return { repository, receipts, current };
}
describe("own-user role guide lifecycle", () => {
  test("existing/new users see guide once across sessions and accounts stay separate", async () => {
    const { repository, current, receipts } = fixture();
    const first = await getOwnRoleGuideUseCase(current.actor, repository);
    expect(first.success && first.data.shouldAutoShow).toBe(true);
    await acknowledgeOwnRoleGuideUseCase(
      current.actor,
      { contextKey: roleGuideContextKey(current.actor) },
      repository,
    );
    const laptop = await getOwnRoleGuideUseCase(
      { ...current.actor, sessionId: "laptop" },
      repository,
    );
    expect(laptop.success && laptop.data.shouldAutoShow).toBe(false);
    const second = await getOwnRoleGuideUseCase(actor("bob"), repository);
    expect(second.success && second.data.shouldAutoShow).toBe(true);
    expect([...receipts.keys()]).toEqual(["alice"]);
    expect(laptop.success && laptop.data.responsibilities.length).toBe(3); // replay still has content
  });
  test("acknowledgment is idempotent and changed relevant access makes a new guide", async () => {
    const { repository, current } = fixture();
    const input = { contextKey: roleGuideContextKey(current.actor) };
    await acknowledgeOwnRoleGuideUseCase(current.actor, input, repository);
    await acknowledgeOwnRoleGuideUseCase(current.actor, input, repository);
    expect(current.saves).toBe(1);
    current.actor = {
      ...current.actor,
      permissions: current.actor.permissions.filter((key) => key !== "create:cost"),
    };
    const result = await getOwnRoleGuideUseCase(current.actor, repository);
    expect(result.success && result.data.shouldAutoShow).toBe(true);
    const stale = await acknowledgeOwnRoleGuideUseCase(current.actor, input, repository);
    expect(!stale.success && stale.error.code).toBe("CONFLICT");
    expect(current.saves).toBe(1);
  });
  test("fresh repository check rejects an old actor snapshot after concurrent access change", async () => {
    const { repository, current } = fixture();
    const oldActor = current.actor;
    current.actor = { ...current.actor, dataScope: "GLOBAL" };
    const result = await acknowledgeOwnRoleGuideUseCase(
      oldActor,
      { contextKey: roleGuideContextKey(oldActor) },
      repository,
    );
    expect(!result.success && result.error.code).toBe("CONFLICT");
    expect(current.saves).toBe(0);
  });
  test("quick start postpones automatic display until owner is ready", async () => {
    const { repository, current } = fixture();
    current.needsSetup = true;
    const before = await getOwnRoleGuideUseCase(current.actor, repository);
    expect(before.success && before.data.shouldAutoShow).toBe(false);
    current.needsSetup = false;
    const after = await getOwnRoleGuideUseCase(current.actor, repository);
    expect(after.success && after.data.shouldAutoShow).toBe(true);
  });
  test("temporary password must precede guidance", async () => {
    const { repository, current } = fixture();
    const locked = { ...current.actor, mustChangePassword: true };
    expect((await getOwnRoleGuideUseCase(locked, repository)).success).toBe(false);
    expect(
      (
        await acknowledgeOwnRoleGuideUseCase(
          locked,
          { contextKey: roleGuideContextKey(locked) },
          repository,
        )
      ).success,
    ).toBe(false);
    expect(current.saves).toBe(0);
  });
  test("developer simulation may preview but never consumes actual user's acknowledgment", async () => {
    const { repository, current, receipts } = fixture();
    const simulated = {
      ...current.actor,
      developerActorUserId: "developer",
      mustChangePassword: true,
    };
    const preview = await getOwnRoleGuideUseCase(simulated, repository);
    expect(preview.success && preview.data.shouldAutoShow).toBe(false);
    expect(preview.success && preview.data.canAcknowledge).toBe(false);
    await acknowledgeOwnRoleGuideUseCase(
      simulated,
      { contextKey: roleGuideContextKey(simulated) },
      repository,
    );
    expect(receipts.size).toBe(0);
  });
  test("network/storage failure and malicious acknowledgment remain structured errors", async () => {
    const { repository, current } = fixture();
    current.fail = true;
    expect((await getOwnRoleGuideUseCase(current.actor, repository)).success).toBe(false);
    const saved = await acknowledgeOwnRoleGuideUseCase(
      current.actor,
      { contextKey: roleGuideContextKey(current.actor) },
      repository,
    );
    expect(!saved.success && saved.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(
      (
        await acknowledgeOwnRoleGuideUseCase(
          current.actor,
          { userId: "bob", contextKey: roleGuideContextKey(current.actor) },
          repository,
        )
      ).success,
    ).toBe(false);
  });
});
