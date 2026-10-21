import { expect, test } from "bun:test";
import {
  lifecycleInputSchema,
  lifecycleIdentitySchema,
  lifecyclePermissions,
} from "./rap-lifecycle";
const id = "00000000-0000-0000-0000-000000000001";
test("revision requires explicit scope and reason, and package revision requires both write rights", () => {
  const base = {
    action: "REVISION",
    projectId: id,
    reason: "Perubahan scope dapur",
    reviseMaterial: false,
    packageIds: [],
  };
  expect(lifecycleInputSchema.safeParse(base).success).toBe(false);
  expect(
    lifecycleInputSchema.safeParse({ ...base, reason: "pendek", reviseMaterial: true }).success,
  ).toBe(false);
  expect(lifecyclePermissions(lifecycleInputSchema.parse({ ...base, packageIds: [id] }))).toEqual([
    "update:rap",
    "update:budget",
  ]);
  expect(
    lifecyclePermissions(lifecycleInputSchema.parse({ ...base, reviseMaterial: true })),
  ).toEqual(["update:rap"]);
});
test("package targets are unique and bounded, confirmation never accepts business patches", () => {
  const row = { itemId: id, action: "REOPEN" };
  expect(
    lifecycleInputSchema.safeParse({ action: "PACKAGE_CHANGES", projectId: id, rows: [row, row] })
      .success,
  ).toBe(false);
  const rows = Array.from({ length: 50 }, (_, i) => ({
    action: "DELETE",
    itemId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  }));
  expect(
    lifecycleInputSchema.safeParse({ action: "PACKAGE_CHANGES", projectId: id, rows }).success,
  ).toBe(true);
  expect(
    lifecycleInputSchema.safeParse({
      action: "PACKAGE_CHANGES",
      projectId: id,
      rows: [...rows, row],
    }).success,
  ).toBe(false);
  expect(
    lifecycleIdentitySchema.safeParse({ conversationId: id, toolCallId: "x", rows: [row] }).success,
  ).toBe(false);
});
