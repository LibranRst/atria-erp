import { describe, expect, test } from "bun:test";
import { adminInvalidations, adminLocalHref, safeAdminReturnTo } from "./paths";

describe("admin canonical navigation", (): void => {
  test("preserves project identity/query/hash while removing old presentation prefixes", (): void => {
    expect(adminLocalHref("/admin/projects/project-1/budget?tab=categories#material")).toBe(
      "/projects/project-1/budget?tab=categories#material",
    );
    expect(adminLocalHref("/profile/password")).toBe("/change-password");
    expect(safeAdminReturnTo("/account")).toBe("/account");
    expect(adminLocalHref("/profile")).toBe("/account");
    expect(adminLocalHref("/onboarding/review?step=stock")).toBe(
      "/onboarding?step=stock&flow=review",
    );
    expect(adminLocalHref("/ledger?surface=mobile")).toBe("/projects");
  });

  test("return destinations reject foreign, control-character and unrelated API URLs", (): void => {
    for (const href of [
      "https://evil.test/projects",
      "//evil.test",
      "/\\evil.test",
      "/%5c%5cevil.test",
      "/api/internal/web-rpc",
      "/login",
      "/projects\n/other",
    ])
      expect(safeAdminReturnTo(href)).toBe("/projects");
    expect(safeAdminReturnTo("/projects/assigned?view=budget#summary")).toBe(
      "/projects/assigned?view=budget#summary",
    );
  });

  test("local invalidations refresh project and budget pages without imaginary desktop paths", (): void => {
    expect(adminInvalidations({ path: "/admin/projects/project-1" })).toEqual([
      { path: "/projects/project-1", type: undefined },
      { path: "/projects/project-1/budget", type: undefined },
    ]);
    expect(adminInvalidations({ path: "/projects/[id]", type: "page" })).toEqual([
      { path: "/projects/[projectId]", type: "page" },
      { path: "/projects/[projectId]/budget", type: "page" },
    ]);
    expect(adminInvalidations({ path: "/ledger" })).toEqual([
      { path: "/projects", type: undefined },
    ]);
    expect(adminInvalidations({ path: "/admin/[...workspace]", type: "page" })).toEqual([
      { path: "/", type: "layout" },
    ]);
    expect(adminInvalidations({ path: "/expenses" })).toEqual([]);
  });
});
