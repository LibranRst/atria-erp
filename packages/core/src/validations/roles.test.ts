import { describe, expect, test } from "bun:test";
import { SYSTEM_ROLES } from "../auth/role-constants";
import {
  createRoleSchema,
  updateRolePermissionsSchema,
  updateRoleDetailsSchema,
  deleteRoleSchema,
} from "./roles";

describe("ID peran sistem dan kustom", () => {
  for (const role of SYSTEM_ROLES) {
    test(`menerima identifier PostgreSQL peran ${role.name}`, () => {
      expect(
        updateRolePermissionsSchema.safeParse({ roleId: role.id, permissions: [] }).success,
      ).toBe(true);
      expect(
        updateRoleDetailsSchema.safeParse({
          roleId: role.id,
          name: "Nama peran",
          dataScope: "NONE",
        }).success,
      ).toBe(true);
      expect(deleteRoleSchema.safeParse({ roleId: role.id }).success).toBe(true);
      expect(
        createRoleSchema.safeParse({
          name: "Salinan",
          dataScope: "NONE",
          permissions: [],
          duplicateFromRoleId: role.id,
        }).success,
      ).toBe(true);
    });
  }
  test("menerima UUID role kustom dan menolak identifier rusak", () => {
    expect(
      updateRolePermissionsSchema.safeParse({ roleId: crypto.randomUUID(), permissions: [] })
        .success,
    ).toBe(true);
    for (const roleId of [
      "",
      "owner",
      "00000000-0000-0000-0000-00000000000z",
      "00000000-0000-0000-0000-000000000001 extra",
    ]) {
      expect(updateRolePermissionsSchema.safeParse({ roleId, permissions: [] }).success).toBe(
        false,
      );
    }
  });
});
