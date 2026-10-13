import { and, count, eq, gte, lt, sum } from "drizzle-orm";
import { db } from "@backend/db";
import { cashTransaction } from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  dashboardDesktopInputSchema,
  paginateDashboardRows,
  type DashboardDesktopRequest,
  type DashboardDesktopData,
} from "@atria/core/finance/dashboard-desktop";
import {
  dashboardCashFlowInputSchema,
  cashFlowMonthRanges,
  buildCashFlowTrend,
  type DashboardCashFlowInput,
  type DashboardCashFlowTrend,
  type CashFlowAggregate,
} from "@atria/core/finance/dashboard-cash-flow";
import { getFinanceDashboardDesktopSourceUseCase } from "./dashboard-overview";

function dashboardAllowed(actor: Actor): boolean {
  return actorCan(actor, "view:ledger") && actor.dataScope === "GLOBAL";
}
function priority(value: string): number {
  return value === "CRITICAL" ? 0 : value === "WARNING" ? 1 : 2;
}
export async function getFinanceDashboardDesktopTabDataUseCase(
  actor: Actor,
  raw: DashboardDesktopRequest,
): Promise<ActionResponse<DashboardDesktopData>> {
  if (!dashboardAllowed(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses Dashboard tidak tersedia." },
    };
  const parsed = dashboardDesktopInputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Filter tabel tidak valid." },
    };
  const input = parsed.data;
  if (input.tab === "budget" && !actorCan(actor, "view:budget"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses budget tidak tersedia." },
    };
  if (input.tab === "materials" && !actorCan(actor, "view:inventory"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses persediaan tidak tersedia." },
    };
  if (input.tab === "approvals" && !actorCan(actor, "view:approval_queue"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses persetujuan tidak tersedia." },
    };
  const source = await getFinanceDashboardDesktopSourceUseCase(actor, input.tab);
  if (!source.success) return source;
  const data = source.data;
  const base = {
    pageSize: input.pageSize,
    generatedAt: data.generatedAt,
    dataQuality: data.dataQuality,
  };
  if (input.tab === "approvals")
    return {
      success: true,
      data: {
        ...base,
        tab: "approvals",
        ...paginateDashboardRows(
          data.dashboardDetails.approvals,
          input,
          (r) => r.id,
          (r) => `${r.projectName} ${r.description} ${r.requestedBy}`,
          (r) => input.filter === "all" || r.type === input.filter,
          (r) =>
            input.sort === "name"
              ? r.projectName
              : input.sort === "amount"
                ? r.amount
                : input.sort === "date"
                  ? r.createdAt.getTime()
                  : data.dashboardDetails.approvals.indexOf(r),
        ),
      },
    };
  if (input.tab === "budget")
    return {
      success: true,
      data: {
        ...base,
        tab: "budget",
        ...paginateDashboardRows(
          data.riskyProjects,
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
                    : priority(r.effectiveHealth) * 10000 - r.usedPercentage,
        ),
      },
    };
  if (input.tab === "cash")
    return {
      success: true,
      data: {
        ...base,
        tab: "cash",
        ...paginateDashboardRows(
          data.dashboardDetails.cashDue,
          input,
          (r) => `${r.type}-${r.id}`,
          (r) => `${r.projectName} ${r.counterpartyName} ${r.documentNumber}`,
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
      },
    };
  return {
    success: true,
    data: {
      ...base,
      tab: "materials",
      ...paginateDashboardRows(
        data.dashboardDetails.materials,
        input,
        (r) => r.id,
        (r) => `${r.materialName} ${r.projectName ?? ""} ${r.locationName ?? ""}`,
        (r) => input.filter === "all" || r.type === input.filter,
        (r) =>
          input.sort === "name"
            ? r.materialName
            : input.sort === "date"
              ? (r.createdAt?.getTime() ?? 0)
              : input.sort === "amount"
                ? (r.quantity ?? r.requiredStock ?? 0)
                : data.dashboardDetails.materials.indexOf(r),
      ),
    },
  };
}

export async function getFinanceDashboardCashFlowTrendUseCase(
  actor: Actor,
  raw: DashboardCashFlowInput,
): Promise<ActionResponse<DashboardCashFlowTrend>> {
  if (!dashboardAllowed(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses tren kas tidak tersedia." },
    };
  const input = dashboardCashFlowInputSchema.safeParse(raw);
  if (!input.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rentang grafik tidak valid." },
    };
  const now = new Date(),
    ranges = cashFlowMonthRanges(input.data.months, now);
  try {
    // Bounded calendar aggregates; never fetch or truncate individual ledger rows.
    const groups: CashFlowAggregate[][] = [];
    for (const range of ranges) {
      const rows = await db
        .select({
          type: cashTransaction.type,
          category: cashTransaction.category,
          referenceType: cashTransaction.referenceType,
          amount: sum(cashTransaction.amount),
          count: count(),
        })
        .from(cashTransaction)
        .where(
          and(
            eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
            gte(cashTransaction.createdAt, range.start),
            lt(cashTransaction.createdAt, range.end),
          ),
        )
        .groupBy(cashTransaction.type, cashTransaction.category, cashTransaction.referenceType);
      groups.push(rows);
    }
    return { success: true, data: buildCashFlowTrend(input.data.months, now, groups) };
  } catch (error) {
    console.error("Cashflow trend read failed", error);
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Tren kas belum dapat dimuat." },
    };
  }
}
