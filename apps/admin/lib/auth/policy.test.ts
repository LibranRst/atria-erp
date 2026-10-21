import { describe, expect, test } from "bun:test";
import { adminAccessDecision, type AdminActor } from "./policy";

const actor: Pick<
  AdminActor,
  "isActive" | "mustChangePassword" | "permissions" | "roleId" | "developerActorUserId"
> = {
  isActive: true,
  mustChangePassword: false,
  permissions: ["use:desktop_admin"],
  roleId: "custom-role",
  developerActorUserId: null,
};

describe("independent admin access", (): void => {
  test("custom role uses its effective permission rather than a role name", (): void => {
    expect(adminAccessDecision({ actor })).toBe("allowed");
    expect(adminAccessDecision({ actor: { ...actor, permissions: ["view:budget"] } })).toBe(
      "restricted",
    );
    expect(adminAccessDecision({ actor: { ...actor, permissions: [] } })).toBe("restricted");
    expect(
      adminAccessDecision({
        actor: { ...actor, permissions: ["use:desktop_admin", "view:budget"] },
      }),
    ).toBe("allowed");
  });

  test("anonymous and inactive accounts cannot enter even with cached admin permission", (): void => {
    expect(adminAccessDecision({ actor: null })).toBe("login");
    expect(adminAccessDecision({ actor: { ...actor, isActive: false } })).toBe("login");
  });

  test("temporary passwords gate entry and only the password route can proceed", (): void => {
    const temporary = { ...actor, mustChangePassword: true };
    expect(adminAccessDecision({ actor: temporary })).toBe("password");
    expect(adminAccessDecision({ actor: temporary, allowPasswordChange: true })).toBe("allowed");
    expect(
      adminAccessDecision({ actor: { ...temporary, developerActorUserId: "claimed-simulation" } }),
    ).toBe("password");
    expect(
      adminAccessDecision({ actor: { ...temporary, permissions: [] }, allowPasswordChange: true }),
    ).toBe("restricted");
  });
});
