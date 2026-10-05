import { describe, expect, test } from "bun:test";
import { assignProjectManagerUseCase } from "./assign-project-manager";
import { assignProjectManagerSchema } from "@atria/core/validations/project";
import type { Actor } from "@backend/server/actor";

function createMockActor(overrides: Partial<Actor>): Actor {
  return {
    userId: "user-1",
    roleId: "role-1",
    roleName: "PROJECT_MANAGER",
    name: "User",
    email: "user@example.com",
    isActive: true,
    mustChangePassword: false,
    sessionId: "session-1",
    permissions: [],
    dataScope: "GLOBAL",
    developerActorUserId: null,
    ...overrides,
  };
}

describe("assignProjectManagerUseCase", () => {
  test("validates input schema correctly", () => {
    const valid = assignProjectManagerSchema.safeParse({
      projectId: "11111111-1111-1111-1111-111111111111",
      projectManagerId: "22222222-2222-2222-2222-222222222222",
    });
    expect(valid.success).toBe(true);

    const missingPm = assignProjectManagerSchema.safeParse({
      projectId: "11111111-1111-1111-1111-111111111111",
      projectManagerId: "",
    });
    expect(missingPm.success).toBe(false);

    const missingProject = assignProjectManagerSchema.safeParse({
      projectId: "",
      projectManagerId: "22222222-2222-2222-2222-222222222222",
    });
    expect(missingProject.success).toBe(false);
  });

  test("rejects unauthorized roles like PM or Purchasing", async () => {
    const pmActor = createMockActor({
      userId: "pm-user-1",
      roleName: "PROJECT_MANAGER",
    });

    const resPm = await assignProjectManagerUseCase(pmActor, {
      projectId: "11111111-1111-1111-1111-111111111111",
      projectManagerId: "22222222-2222-2222-2222-222222222222",
    });
    expect(resPm.success).toBe(false);
    if (!resPm.success) {
      expect(resPm.error.code).toBe("FORBIDDEN");
    }

    const purchasingActor = createMockActor({
      userId: "purchasing-user-1",
      roleName: "PURCHASING",
    });

    const resPurchasing = await assignProjectManagerUseCase(purchasingActor, {
      projectId: "11111111-1111-1111-1111-111111111111",
      projectManagerId: "22222222-2222-2222-2222-222222222222",
    });
    expect(resPurchasing.success).toBe(false);
    if (!resPurchasing.success) {
      expect(resPurchasing.error.code).toBe("FORBIDDEN");
    }
  });
});
