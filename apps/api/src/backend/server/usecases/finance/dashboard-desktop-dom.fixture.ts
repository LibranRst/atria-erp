import { mock, spyOn } from "bun:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Actor } from "@backend/server/actor";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import {
  buildFinanceDashboardCore,
  buildDashboardProjectRows,
  type DashboardProjectInput,
} from "@atria/core/finance/dashboard-overview";
const conditions: SQL[] = [];
let selects = 0;
let aggregateFails = false;
mock.module("@backend/db", () => ({
  db: {
    select: () => {
      selects++;
      return {
        from: () => ({
          where: (where: SQL) => {
            conditions.push(where);
            return {
              groupBy: async () => {
                if (aggregateFails) throw new Error("Synthetic ledger outage");
                return [
                  {
                    type: "INFLOW",
                    category: "client_payment",
                    referenceType: "client_payment",
                    amount: "0.10",
                    count: 1,
                  },
                ];
              },
            };
          },
        }),
      };
    },
  },
}));
const projects: DashboardProjectInput[] = Array.from({ length: 27 }, (_, index) => ({
  projectId: `project-${index}`,
  projectName: `Proyek ${index}`,
  financialHealth: "HEALTHY",
  contractValue: 1000,
  internalBudget: 800,
  targetGrossAmount: 200,
  categories: [
    {
      code: "MATERIAL",
      name: "Material",
      allocatedAmount: 800,
      actualAmount: index * 10,
      paidAmount: 0,
      pendingAmount: 0,
      sortOrder: 0,
    },
  ],
}));
const core = buildFinanceDashboardCore({
  decidesCostApprovals: true,
  cashAvailable: 0,
  receivables: [],
  payables: [],
  projects,
  pendingApprovals: 0,
  materialShortageCount: 0,
  lowStockCount: 0,
  now: new Date(),
});
let fullReads = 0;
let sourceFails = false;
let sourcePartial = false;
mock.module("./dashboard-overview", () => ({
  getFinanceDashboardDesktopSourceUseCase: async (_actor: Actor, focus: string) => {
    assert.ok(focus === "budget" || focus === "materials");
    fullReads++;
    if (sourceFails)
      return {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Synthetic source outage" },
      };
    return {
      success: true,
      data: {
        ...core,
        role: "CUSTOM_FINANCE",
        generatedAt: new Date(),
        dataQuality: {
          partial: sourcePartial,
          unavailableSources: sourcePartial ? ["inventori"] : [],
        },
        riskyProjects: buildDashboardProjectRows(projects),
        bankAccounts: [],
        dashboardDetails: {
          approvals: [],
          approvalSummary: { totalCount: 0, criticalCount: 0, waitingLongCount: 0, totalAmount: 0 },
          cashDue: [],
          cashDueGroups: [],
          budgetRisks: [],
          materials: [],
        },
        stockIssues: {
          materialShortageCount: 0,
          lowStockCount: 0,
          totalStockValue: 0,
          reusableStockValue: 0,
        },
        recentTransactions: [],
      },
    };
  },
}));
const { getFinanceDashboardCashFlowTrendUseCase, getFinanceDashboardDesktopTabDataUseCase } =
  await import("./dashboard-desktop");
const actor: Actor = {
  userId: "test",
  roleId: "custom",
  roleName: "CUSTOM_FINANCE",
  name: "Pengujian",
  email: "fixture@example.test",
  isActive: true,
  mustChangePassword: false,
  sessionId: "fixture",
  permissions: ["view:ledger"],
  dataScope: "GLOBAL",
  developerActorUserId: null,
};
assert.equal(
  (await getFinanceDashboardCashFlowTrendUseCase({ ...actor, permissions: [] }, { months: 6 }))
    .success,
  false,
);
assert.equal(
  (
    await getFinanceDashboardCashFlowTrendUseCase(
      { ...actor, dataScope: "ASSIGNED" },
      { months: 6 },
    )
  ).success,
  false,
);
assert.equal(
  (await getFinanceDashboardDesktopTabDataUseCase(actor, { tab: "budget" })).success,
  false,
);
assert.equal(
  (await getFinanceDashboardDesktopTabDataUseCase(actor, { tab: "materials" })).success,
  false,
);
assert.equal(
  (await getFinanceDashboardDesktopTabDataUseCase(actor, { tab: "approvals" })).success,
  false,
);
assert.equal(selects, 0, "unauthorized and domain-limited reads never touch ledger");
const page = await getFinanceDashboardDesktopTabDataUseCase(
  { ...actor, permissions: ["view:ledger", "view:budget"] },
  { tab: "budget", page: 2, sort: "amount", direction: "descending" },
);
assert.ok(page.success);
if (!page.success) throw Error("Page unavailable");
assert.equal(page.data.total, 27);
assert.equal(page.data.rows.length, 10);
if (page.data.tab === "budget") assert.equal(page.data.rows[0]?.actualCost, 160);
assert.equal(fullReads, 1);
sourcePartial = true;
const partial = await getFinanceDashboardDesktopTabDataUseCase(
  { ...actor, permissions: ["view:ledger", "view:inventory"] },
  { tab: "materials" },
);
assert.ok(partial.success);
if (!partial.success) throw Error("Partial source unexpectedly failed");
assert.equal(partial.data.dataQuality.partial, true);
assert.deepEqual(partial.data.dataQuality.unavailableSources, ["inventori"]);
sourcePartial = false;
sourceFails = true;
const unavailable = await getFinanceDashboardDesktopTabDataUseCase(
  { ...actor, permissions: ["view:ledger", "view:budget"] },
  { tab: "budget" },
);
assert.equal(unavailable.success, false, "failed source must not become a healthy empty page");
sourceFails = false;
const result = await getFinanceDashboardCashFlowTrendUseCase(actor, { months: 6 });
assert.equal(result.success, true);
assert.equal(selects, 6, "six bounded aggregates, not a recent-row preview");
if (!result.success) throw Error("Fixture failed");
assert.equal(result.data.buckets.length, 6);
assert.equal(result.data.totalNet, 0.6);
const dialect = new PgDialect();
for (const condition of conditions) {
  const query = dialect.sqlToQuery(condition);
  assert.ok(query.params.includes(INSTANCE_TENANT_ID), "foreign-tenant rows are constrained out");
  assert.equal(
    query.params.slice(1).filter((value) => Number.isFinite(new Date(String(value)).getTime()))
      .length,
    2,
  );
  assert.ok(query.sql.includes('"created_at"'));
}
const lastQuery = dialect.sqlToQuery(conditions[5]!);
assert.ok(
  lastQuery.params.some(
    (value) => new Date(String(value)).getTime() === result.data.generatedAt.getTime(),
  ),
  "current/future cutoff uses the fixed read timestamp",
);
aggregateFails = true;
const errorLog = spyOn(console, "error").mockImplementation((): void => {});
const failedTrend = await getFinanceDashboardCashFlowTrendUseCase(actor, { months: 6 });
errorLog.mockRestore();
assert.equal(failedTrend.success, false, "failed aggregate must not become zero cashflow");
console.log("desktop cashflow auth, tenant and bounded query regression passed");
