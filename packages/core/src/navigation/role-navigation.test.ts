import { describe, expect, test } from "bun:test";

import { ROLE_PERMISSIONS, type PermissionKey } from "../auth/permissions";
import { getRoleNavItems } from "./role-navigation";

function labelsFor(permissions: readonly PermissionKey[]): string[] {
  return getRoleNavItems(permissions).map((item) => item.label);
}

function labelsForSeedRole(roleName: string): string[] {
  return labelsFor(ROLE_PERMISSIONS[roleName] ?? []);
}

describe("role navigation", () => {
  test("owner dan finance memakai tiga tujuan finansial", () => {
    expect(labelsForSeedRole("OWNER")).toEqual(["Dashboard", "Projects", "Expenses"]);
    expect(labelsForSeedRole("FINANCE_ADMIN")).toEqual(["Dashboard", "Projects", "Expenses"]);
  });

  test("purchasing dan project manager mendapat tujuan operasional sesuai peran", () => {
    expect(labelsForSeedRole("PURCHASING")).toEqual(["Materials", "Expenses"]);
    expect(labelsForSeedRole("PROJECT_MANAGER")).toEqual(["Projects", "Materials", "Expenses"]);
  });

  test("peran buatan mendapat tab sesuai izin yang benar-benar diberikan", () => {
    /*
     * Sebelumnya setiap peran di luar keempat nama bawaan mendarat di satu
     * cabang tetap, sehingga izin yang diberikan Owner tidak mengubah apa pun
     * di bilah bawah.
     */
    expect(labelsFor(["view:project", "view:cost"])).toEqual(["Projects", "Expenses"]);
    expect(labelsFor(["view:inventory"])).toEqual(["Materials"]);
    expect(labelsFor(["view:ledger", "view:project", "view:inventory", "view:cost"])).toEqual([
      "Dashboard",
      "Projects",
      "Expenses",
    ]);
  });

  test("peran tanpa izin tidak mendapat tujuan apa pun", () => {
    expect(labelsFor([])).toEqual([]);
  });
});
