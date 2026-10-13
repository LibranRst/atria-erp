import { expect, test } from "bun:test";
import { canAccessAdminPath } from "./admin-navigation";
import type { PermissionKey } from "@atria/core/auth/permissions";

test("onboarding URLs retain permission gating when they include step and anchor", () => {
  const owner: readonly PermissionKey[] = ["use:desktop_admin", "manage:onboarding"];
  expect(canAccessAdminPath("/onboarding?step=welcome", owner)).toBe(true);
  expect(canAccessAdminPath("/admin/onboarding?step=budget#allocation", owner)).toBe(true);
  expect(canAccessAdminPath("/onboarding?step=welcome", ["use:desktop_admin"])).toBe(false);
  expect(
    canAccessAdminPath("/onboarding/review?batch=123", ["use:desktop_admin", "review:onboarding"]),
  ).toBe(true);
});

test("desktop access never grants a module or creation capability", () => {
  expect(
    canAccessAdminPath("/admin/projects/project-123?tab=rap", [
      "use:desktop_admin",
      "view:project",
    ]),
  ).toBe(true);
  expect(canAccessAdminPath("/admin/projects/project-123?tab=rap", ["view:project"])).toBe(true);
  expect(canAccessAdminPath("/admin/settings?tab=organization", ["use:desktop_admin"])).toBe(false);
  expect(canAccessAdminPath("/admin/expenses/new", ["use:desktop_admin", "view:cost"])).toBe(false);
  expect(canAccessAdminPath("/admin/expenses/new", ["use:desktop_admin", "create:cost"])).toBe(
    true,
  );
});

test("external and unknown destinations cannot be mistaken for a workspace", () => {
  const grants: readonly PermissionKey[] = ["use:desktop_admin", "view:project", "view:settings"];
  for (const path of [
    "https://example.com/projects",
    "//example.com/projects",
    "/api/projects",
    "/admin/settings/unknown",
    "/projects\\settings",
  ]) {
    expect(canAccessAdminPath(path, grants)).toBe(false);
  }
});

test("responsive navigation uses each role's domain permissions without a desktop grant", () => {
  expect(canAccessAdminPath("/projects/project-123?tab=budget", ["view:project"])).toBe(true);
  expect(canAccessAdminPath("/ledger", ["view:project"])).toBe(false);
  expect(canAccessAdminPath("/materials", ["view:inventory"])).toBe(true);
  expect(canAccessAdminPath("/expenses/new", ["view:cost"])).toBe(false);
});
