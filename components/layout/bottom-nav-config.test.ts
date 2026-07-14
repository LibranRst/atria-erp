import { describe, expect, test } from "bun:test";

import { buildFabActions } from "./bottom-nav-config";

function actions(roleName: string, pathname: string) {
  return buildFabActions({
    roleName,
    pathname,
    isProjectDetail: /^\/projects\/[^/]+/.test(pathname),
    isCurrentProjectLocked: false,
    withQuery: (key, value = "true", targetPath = pathname) =>
      `${targetPath}?${key}=${value}`,
  });
}

describe("contextual FAB actions", () => {
  test("keeps Projects focused on adding a project for Owner", () => {
    expect(actions("OWNER", "/projects").map((item) => item.label)).toEqual([
      "Project Baru",
    ]);
  });

  test("keeps Finance focused on expense and vendor bill actions", () => {
    expect(actions("FINANCE_ADMIN", "/expenses").map((item) => item.label)).toEqual([
      "Expense Lapangan",
      "Tagihan Vendor",
    ]);
  });

  test("does not expose stock mutations to Project Manager", () => {
    expect(actions("PROJECT_MANAGER", "/materials").map((item) => item.label)).toEqual([
      "Expense Lapangan",
    ]);
  });

  test("shows operational stock actions to Purchasing without Owner-only adjustment", () => {
    const labels = actions("PURCHASING", "/materials").map((item) => item.label);
    expect(labels).toContain("Terima Barang");
    expect(labels).toContain("Stock Opname");
    expect(labels).not.toContain("Penyesuaian Darurat");
  });

  test("does not expose project creation to Project Manager", () => {
    expect(actions("PROJECT_MANAGER", "/projects").map((item) => item.label)).toEqual([
      "Expense Lapangan",
    ]);
  });

  test("keeps Purchasing on the vendor-bill workflow from Projects", () => {
    expect(actions("PURCHASING", "/projects").map((item) => item.label)).toEqual([
      "Tagihan Vendor",
    ]);
  });
});
