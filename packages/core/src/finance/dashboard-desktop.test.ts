import { expect, test } from "bun:test";
import { dashboardDesktopInputSchema, paginateDashboardRows } from "./dashboard-desktop";
import { buildDashboardProjectRows, type DashboardProjectInput } from "./dashboard-overview";
const projects: DashboardProjectInput[] = Array.from({ length: 27 }, (_, i) => ({
  projectId: `p${String(i).padStart(2, "0")}`,
  projectName: `Proyek ${i}`,
  financialHealth: "HEALTHY",
  contractValue: 1000,
  internalBudget: 800,
  targetGrossAmount: 200,
  categories: [
    {
      code: "MATERIAL",
      name: "Material",
      allocatedAmount: 800,
      actualAmount: i * 10,
      paidAmount: i * 5,
      pendingAmount: 0,
      sortOrder: 0,
    },
  ],
}));
test("complete desktop budget rows include healthy projects while snapshots remain bounded", () => {
  expect(buildDashboardProjectRows(projects)).toHaveLength(27);
  expect(buildDashboardProjectRows(projects)[0]?.effectiveHealth).toBe("HEALTHY");
});
test("sort and search run across all matches before page slicing", () => {
  const rows = buildDashboardProjectRows(projects),
    input = dashboardDesktopInputSchema.parse({
      tab: "budget",
      page: 2,
      sort: "amount",
      direction: "descending",
    });
  const result = paginateDashboardRows(
    rows,
    input,
    (r) => r.projectId,
    (r) => r.projectName,
    () => true,
    (r) => r.actualCost,
  );
  expect(result.total).toBe(27);
  expect(result.rows).toHaveLength(10);
  expect(result.rows[0]?.actualCost).toBe(160);
  const filtered = paginateDashboardRows(
    rows,
    { ...input, search: "Proyek 2" },
    (r) => r.projectId,
    (r) => r.projectName,
    () => true,
    (r) => r.actualCost,
  );
  expect(filtered.total).toBe(8);
  expect(filtered.page).toBe(1);
  expect(filtered.rows[0]?.projectName).toBe("Proyek 26");
});
test("tab filters/sorts and page sizes are validated", () => {
  expect(dashboardDesktopInputSchema.safeParse({ tab: "cash", filter: "HEALTHY" }).success).toBe(
    false,
  );
  expect(dashboardDesktopInputSchema.safeParse({ tab: "materials", sort: "margin" }).success).toBe(
    false,
  );
  expect(dashboardDesktopInputSchema.safeParse({ tab: "budget", pageSize: 500 }).success).toBe(
    false,
  );
});
