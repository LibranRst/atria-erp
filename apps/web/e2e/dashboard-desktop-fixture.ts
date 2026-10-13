/** Synthetic desktop rows only; never imported by production routes. */
import type {
  FinanceDashboardOverview,
  FinanceDashboardCashDueItem,
  FinanceDashboardMaterialIssue,
} from "@atria/core/finance/dashboard-contracts";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import {
  dashboardDesktopInputSchema,
  paginateDashboardRows,
  type DashboardDesktopRequest,
  type DashboardDesktopData,
} from "@atria/core/finance/dashboard-desktop";
export function fixtureDesktopPage(
  snapshot: FinanceDashboardOverview,
  empty: boolean,
  raw: DashboardDesktopRequest,
): DashboardDesktopData {
  const input = dashboardDesktopInputSchema.parse(raw),
    now = snapshot.generatedAt;
  const base = { pageSize: input.pageSize, generatedAt: now, dataQuality: snapshot.dataQuality };
  const count = empty ? 0 : 27;
  if (input.tab === "budget") {
    const template = snapshot.riskyProjects[0];
    const rows = template
      ? Array.from({ length: count }, (_, i) => ({
          ...template,
          projectId: `fixture-project-${i}`,
          projectName: `Proyek Sintetis ${String(i + 1).padStart(2, "0")}`,
          actualCost: template.actualCost + i * 10000,
        }))
      : [];
    return {
      ...base,
      tab: "budget",
      ...paginateDashboardRows(
        rows,
        input,
        (r) => r.projectId,
        (r) => r.projectName,
        (r) => input.filter === "all" || r.effectiveHealth === input.filter,
        (r) =>
          input.sort === "name"
            ? r.projectName
            : input.sort === "amount"
              ? r.actualCost
              : input.sort === "remaining"
                ? r.remainingBudget
                : input.sort === "margin"
                  ? r.projectedMarginPercentage
                  : 0,
      ),
    };
  }
  if (input.tab === "approvals") {
    const rows: ApprovalDetail[] = Array.from({ length: count }, (_, i) => ({
      id: `fixture-cost-${i}`,
      referenceId: `fixture-cost-${i}`,
      type: "project_cost",
      createdAt: new Date(now.getTime() - i * 86400000),
      dueDate: null,
      notes: null,
      amount: 1000000 + i * 750000,
      description: `Biaya lapangan sintetis ${i + 1}`,
      receiptImageUrl: null,
      projectName: `Proyek Sintetis ${i + 1}`,
      budgetItemName: "Material",
      allocatedAmount: 50000000,
      actualSpent: 10000000,
      requestedBy: "Pemohon Pengujian",
      priority: i < 4 ? "CRITICAL" : "NORMAL",
      priorityReason: i < 4 ? "Menunggu keputusan Owner" : "Pengajuan menunggu review",
      budgetOverrun: false,
      consumesBudgetActual: true,
    }));
    return {
      ...base,
      tab: "approvals",
      ...paginateDashboardRows(
        rows,
        input,
        (r) => r.id,
        (r) => r.projectName,
        (r) => input.filter === "all" || input.filter === r.type,
        (r) =>
          input.sort === "amount"
            ? r.amount
            : input.sort === "name"
              ? r.projectName
              : input.sort === "date"
                ? r.createdAt.getTime()
                : rows.indexOf(r),
      ),
    };
  }
  if (input.tab === "cash") {
    const rows: FinanceDashboardCashDueItem[] = Array.from({ length: count }, (_, i) => ({
      id: `fixture-doc-${i}`,
      type: i % 2 ? "receivable" : "payable",
      amount: 30000000,
      paidAmount: 5000000,
      outstandingAmount: 25000000,
      dueDate: new Date(now.getTime() + (i - 3) * 86400000),
      projectName: `Proyek Sintetis ${i + 1}`,
      counterpartyName: i % 2 ? "Klien Pengujian" : "Vendor Pengujian",
      documentNumber: `DOK-UJI-${i + 1}`,
      status: "PARTIALLY_PAID",
      bucket: i < 3 ? "OVERDUE" : i === 3 ? "TODAY" : i < 11 ? "NEXT_7_DAYS" : "LATER",
      dayOffset: i - 3,
      href: "/projects",
    }));
    return {
      ...base,
      tab: "cash",
      ...paginateDashboardRows(
        rows,
        input,
        (r) => r.id,
        (r) => r.projectName,
        (r) =>
          (input.filter === "all" || r.type === input.filter) &&
          (input.bucket === "all" || r.bucket === input.bucket),
        (r) =>
          input.sort === "name"
            ? r.counterpartyName
            : input.sort === "amount"
              ? r.outstandingAmount
              : r.dueDate.getTime(),
      ),
    };
  }
  const rows: FinanceDashboardMaterialIssue[] = Array.from({ length: count }, (_, i) => ({
    id: `fixture-material-${i}`,
    type: i % 3 === 0 ? "REVERSAL_REQUEST" : i % 2 ? "LOW_STOCK" : "RAP_SHORTAGE",
    severity: i < 4 ? "CRITICAL" : "WARNING",
    materialName: `Material Sintetis ${i + 1}`,
    projectName: `Proyek Sintetis ${i + 1}`,
    locationName: "Gudang Pengujian",
    availableStock: 5,
    requiredStock: 12,
    minimumStock: 10,
    quantity: 7,
    createdAt: now,
    unit: "lembar",
    description: "Data material sintetis untuk pemeriksaan desktop",
    href: "/materials",
  }));
  return {
    ...base,
    tab: "materials",
    ...paginateDashboardRows(
      rows,
      input,
      (r) => r.id,
      (r) => r.materialName,
      (r) => input.filter === "all" || r.type === input.filter,
      (r) => (input.sort === "name" ? r.materialName : rows.indexOf(r)),
    ),
  };
}
