import { describe, expect, test } from "bun:test";

import { SYSTEM_ROLES } from "@/lib/auth/role-constants";
import {
  changeTemporaryPasswordSchema,
  createStaffUserSchema,
  updateStaffUserSchema,
} from "@/lib/validations/administration";

describe("administration validation", () => {
  test("accepts canonical system role IDs when creating a user", () => {
    for (const role of SYSTEM_ROLES) {
      const result = createStaffUserSchema.safeParse({
        name: "User Dekoria",
        email: `${role.name}@dekoria.com`,
        roleId: role.id,
        temporaryPassword: "Password1234",
      });

      expect(result.success).toBe(true);
    }
  });

  test("keeps user IDs strict while accepting a canonical role on update", () => {
    const result = updateStaffUserSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Finance Dekoria",
      roleId: SYSTEM_ROLES[1].id,
      isActive: true,
    });

    expect(result.success).toBe(true);
    expect(
      updateStaffUserSchema.safeParse({
        userId: "not-a-user-id",
        name: "Finance Dekoria",
        roleId: SYSTEM_ROLES[1].id,
        isActive: true,
      }).success,
    ).toBe(false);
  });

  test("rejects malformed role IDs", () => {
    const result = createStaffUserSchema.safeParse({
      name: "User Dekoria",
      email: "user@dekoria.com",
      roleId: "finance-admin",
      temporaryPassword: "Password1234",
    });

    expect(result.success).toBe(false);
  });

  test("accepts a valid new password that differs from the temporary password", () => {
    const result = changeTemporaryPasswordSchema.safeParse({
      currentPassword: "TemporaryPassword123",
      newPassword: "PermanentPassword456",
    });

    expect(result.success).toBe(true);
  });

  test("rejects reusing the temporary password", () => {
    const result = changeTemporaryPasswordSchema.safeParse({
      currentPassword: "TemporaryPassword123",
      newPassword: "TemporaryPassword123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Password baru tidak boleh sama dengan password sementara. Masukkan password pribadi yang berbeda.",
      );
    }
  });
});
