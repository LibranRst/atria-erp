import { describe, expect, test } from "bun:test";

import { getRoleNavItems } from "./role-navigation";

function labelsFor(roleName: string | null): string[] {
  return getRoleNavItems(roleName).map((item) => item.label);
}

describe("role navigation", () => {
  test("owner dan finance memakai tiga tujuan finansial", () => {
    expect(labelsFor("OWNER")).toEqual(["Dashboard", "Projects", "Expenses"]);
    expect(labelsFor("FINANCE_ADMIN")).toEqual(["Dashboard", "Projects", "Expenses"]);
  });

  test("purchasing dan project manager mendapat tujuan operasional sesuai peran", () => {
    expect(labelsFor("PURCHASING")).toEqual(["Projects", "Materials", "Expenses"]);
    expect(labelsFor("PROJECT_MANAGER")).toEqual(["Projects", "Materials", "Expenses"]);
  });

  test("peran lain dan sesi tanpa role tidak pernah mendapat dashboard", () => {
    expect(labelsFor("DESIGNER")).toEqual(["Projects", "Materials", "Expenses"]);
    expect(labelsFor(null)).toEqual(["Projects", "Expenses"]);
  });
});
