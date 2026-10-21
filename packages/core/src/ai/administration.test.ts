import { test, expect } from "bun:test";
import {
  administrationInputSchema,
  administrationIdentitySchema,
  administrationPermission,
  projectScopeLabel,
} from "./administration";
const id = "00000000-0000-4000-8000-000000000001",
  reason = "Koreksi administrasi yang ditinjau pengguna";
test("staff partial/batch contracts preserve omissions and reject credentials, duplicates and empty edits", () => {
  const input = administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: [{ userId: id, patch: { name: "Budi" } }],
    reason,
  });
  expect(administrationPermission(input)).toBe("manage:users");
  if (input.action !== "STAFF_CHANGES") throw new Error("fixture");
  expect(input.users[0].patch.roleId).toBeUndefined();
  for (const patch of [
    {},
    { email: "new@fixture.invalid" },
    { password: "Secret" },
    { roleName: "Owner" },
  ])
    expect(
      administrationInputSchema.safeParse({ ...input, users: [{ userId: id, patch }] }).success,
    ).toBe(false);
  expect(
    administrationInputSchema.safeParse({ ...input, users: [input.users[0], input.users[0]] })
      .success,
  ).toBe(false);
});
test("role partial clearing/scope is explicit and permissions/Owner bypass fields rejected", () => {
  const input = administrationInputSchema.parse({
    action: "ROLE_DETAILS",
    roleId: id,
    patch: { description: null, dataScope: "ASSIGNED" },
    reason,
  });
  expect(administrationPermission(input)).toBe("manage:roles");
  for (const patch of [
    {},
    { permissions: ["manage:users"] },
    { isSystem: false },
    { dataScope: "ALL" },
    { name: "123abc" },
  ])
    expect(administrationInputSchema.safeParse({ ...input, patch }).success).toBe(false);
  expect(projectScopeLabel("ASSIGNED")).toBe("Proyek yang ditugaskan");
});
test("delete and identity-only confirmation cannot carry alternative targets or patches", () => {
  expect(
    administrationInputSchema.safeParse({ action: "ROLE_DELETE", roleId: id, reason: "ok" })
      .success,
  ).toBe(false);
  expect(
    administrationIdentitySchema.safeParse({ conversationId: id, toolCallId: "call", roleId: id })
      .success,
  ).toBe(false);
});
