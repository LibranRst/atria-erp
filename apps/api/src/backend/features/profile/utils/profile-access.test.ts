import { describe, expect, test } from "bun:test";
import { countAccessibleProfileModules, summarizeProfileAccess } from "./profile-access";

describe("Profile access presentation", () => {
  test("retains real domain grants and omissions without the historical desktop gate", () => {
    const groups = summarizeProfileAccess(["view:project", "view:budget"]);
    expect(groups).toEqual(
      summarizeProfileAccess(["view:project", "view:budget", "use:desktop_admin"]),
    );
    expect(groups.some((group) => group.key === "workspace")).toBe(false);
    expect(
      groups.every(
        (group) => group.totalCount > 0 && group.totalCount === group.permissions.length,
      ),
    ).toBe(true);
    expect(
      groups
        .flatMap((group) => group.permissions)
        .filter((permission) => permission.granted)
        .map((permission) => permission.key)
        .sort(),
    ).toEqual(["view:budget", "view:project"]);
    expect(
      groups.flatMap((group) => group.permissions).some((permission) => !permission.granted),
    ).toBe(true);
  });

  test("compatibility grants alone never increase available module counts", () => {
    const groups = summarizeProfileAccess(["use:desktop_admin", "view:ai_brief"]);
    expect(countAccessibleProfileModules(groups)).toBe(0);
    expect(
      groups.flatMap((group) => group.permissions).map((permission) => permission.key),
    ).not.toContain("use:desktop_admin");
    expect(
      groups.flatMap((group) => group.permissions).map((permission) => permission.key),
    ).not.toContain("view:ai_brief");
    expect(
      summarizeProfileAccess(["use:ai_chat", "view:ai_brief"]).find((group) => group.key === "ai"),
    ).toMatchObject({ grantedCount: 1, totalCount: 1 });
  });
});
