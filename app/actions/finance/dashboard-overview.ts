"use server";

import { cookies } from "next/headers";
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { cashTransaction, goodsReceipt, project, stockMovement } from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { getPendingApprovalDetails, rankPendingApprovals } from "@/lib/finance/approval-details";
import {
  buildFinanceDashboardCore,
  DASHBOARD_TAB_DETAIL_LIMIT,
  limitDashboardTabDetails,
  dashboardDueDayOffset,
  resolveDashboardDueBucket,
  type DashboardProjectInput,
  type DashboardRole,
} from "@/lib/finance/dashboard-overview";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  outstandingAmount,
  toCategoryCode,
  type FinanceDashboardCashDueGroup,
  type FinanceDashboardCashDueItem,
  type FinanceDashboardMaterialIssue,
  type FinanceDashboardOverview,
} from "./dashboard-overview-utils";

export type {
  FinanceDashboardBankAccount,
  FinanceDashboardCashDueItem,
  FinanceDashboardCashDueGroup,
  FinanceDashboardMaterialIssue,
  FinanceDashboardOverview,
  FinanceDashboardRecentTransaction,
  FinanceDashboardTabDetails,
} from "./dashboard-overview-utils";

function optionalData<T>(
  result: PromiseSettledResult<T>,
  source: string,
  fallback: T,
  unavailableSources: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`Dashboard supporting source failed: ${source}`, result.reason);
  unavailableSources.push(source);
  return fallback;
}

const DUE_GROUPS: readonly { readonly bucket: FinanceDashboardCashDueItem["bucket"]; readonly label: string }[] = [
  { bucket: "OVERDUE", label: "Terlambat" },
  { bucket: "TODAY", label: "Hari ini" },
  { bucket: "NEXT_7_DAYS", label: "7 hari ke depan" },
  { bucket: "LATER", label: "Berikutnya" },
];

function buildCashDueGroups(items: readonly FinanceDashboardCashDueItem[]): readonly FinanceDashboardCashDueGroup[] {
  return DUE_GROUPS.map((group) => {
    const matches = items.filter((item) => item.bucket === group.bucket);
    return {
      ...group,
      count: matches.length,
      totalOutstanding: matches.reduce((sum, item) => sum + item.outstandingAmount, 0),
      items: limitDashboardTabDetails(matches, 3),
    };
  });
}

export async function getFinanceDashboardOverview(): Promise<
  ActionResponse<FinanceDashboardOverview>
> {
  const session = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  if (!session?.user)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };

  const resolvedRole = await resolveRoleName(session.user.roleId);
  if (resolvedRole !== "OWNER" && resolvedRole !== "FINANCE_ADMIN") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Dashboard hanya tersedia untuk Owner dan Finance Admin.",
      },
    };
  }
  const role: DashboardRole = resolvedRole;

  try {
    const activeProjects = await db.query.project.findMany({
      where: eq(project.status, "ACTIVE"),
    });
    const activeProjectIds = activeProjects.map((item) => item.id);
    const [accounts, invoices, bills, budgets] = await Promise.all([
      db.query.bankAccount.findMany({
        with: {
          cashTransactions: {
            orderBy: [desc(cashTransaction.createdAt)],
            limit: 8,
          },
        },
      }),
      db.query.clientInvoice.findMany({
        with: { payments: true, project: true },
      }),
      db.query.vendorBill.findMany({
        with: { payments: true, project: true, vendor: true },
      }),
      activeProjectIds.length === 0
        ? Promise.resolve([])
        : db.query.projectBudgets.findMany({
            where: (table, operators) =>
              operators.inArray(table.projectId, activeProjectIds),
            with: {
              project: true,
              categories: { with: { expenseCategory: true } },
            },
          }),
    ]);

    const optionalResults = await Promise.allSettled([
      role === "OWNER" ? getPendingApprovalDetails() : Promise.resolve([]),
      db.query.materialInventory.findMany({ with: { material: true, location: true } }),
      db.query.projectRapItem.findMany({
        with: {
          rap: { with: { project: true } },
          material: { with: { inventory: true } },
        },
      }),
      db.query.cashTransaction.findMany({ orderBy: [desc(cashTransaction.createdAt)], limit: 5 }),
      db.query.goodsReceipt.findMany({
        where: eq(goodsReceipt.status, "REVERSAL_REQUESTED"),
        with: { project: true, inventoryLocation: true },
        orderBy: [desc(goodsReceipt.createdAt)],
        limit: 5,
      }),
      db.query.stockMovement.findMany({
        where: inArray(stockMovement.movementType, ["WASTE", "ADJUSTMENT", "EMERGENCY_ADJUSTMENT", "STOCK_COUNT_ADJUSTMENT"]),
        with: { material: true, location: true, project: true },
        orderBy: [desc(stockMovement.createdAt)],
        limit: 5,
      }),
    ] as const);
    const unavailableSources: string[] = [];
    const approvalDetails = optionalData(optionalResults[0], "persetujuan", [], unavailableSources);
    const inventoryRows = optionalData(optionalResults[1], "inventori", [], unavailableSources);
    const rapItems = optionalData(optionalResults[2], "kebutuhan RAP", [], unavailableSources);
    const transactions = optionalData(optionalResults[3], "aktivitas kas", [], unavailableSources);
    const reversalReceipts = optionalData(optionalResults[4], "penerimaan material", [], unavailableSources);
    const materialMovements = optionalData(optionalResults[5], "pergerakan material", [], unavailableSources);
    const now = new Date();
    const rankedApprovalDetails = rankPendingApprovals(approvalDetails, now);
    const pendingApprovalCount = rankedApprovalDetails.length;

    const totalStockValue = inventoryRows.reduce(
      (sum, item) => sum + Number(item.currentStock) * Number(item.averageCost),
      0,
    );
    const reusableStockValue = inventoryRows.reduce(
      (sum, item) =>
        sum +
        Math.max(0, Number(item.currentStock) - Number(item.reservedStock)) *
          Number(item.averageCost),
      0,
    );
    const lowStockCount = inventoryRows.filter(
      (item) =>
        Number(item.currentStock) - Number(item.reservedStock) <=
        Number(item.minimumStock),
    ).length;
    const liveRapItems = rapItems.filter(
      (item) =>
        activeProjectIds.includes(item.rap.projectId) &&
        item.rap.status !== "SUPERSEDED",
    );
    const materialShortageCount = liveRapItems.filter((item) => {
      const available =
        item.material?.inventory.reduce(
          (sum, inventory) =>
            sum +
            Number(inventory.currentStock) -
            Number(inventory.reservedStock),
          0,
        ) ?? 0;
      return Number(item.totalQuantity) > available;
    }).length;
    const cashDue: FinanceDashboardCashDueItem[] = [
      ...bills.map((bill): FinanceDashboardCashDueItem | null => {
        const paidAmount = bill.payments
          .filter((payment) => payment.status === "COMPLETED")
          .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
        const outstanding = outstandingAmount(
          Number(bill.amount),
          paidAmount,
          bill.status,
        );
        if (outstanding <= 0) return null;
        return {
          id: bill.id,
          type: "payable",
          amount: Number(bill.amount),
          paidAmount,
          outstandingAmount: outstanding,
          dueDate: bill.dueDate,
          projectName: bill.project?.name ?? "Proyek Tidak Dikenal",
          counterpartyName: bill.vendor?.name ?? "Vendor",
          documentNumber: bill.billNumber,
          status: bill.status,
          bucket: resolveDashboardDueBucket(bill.dueDate, now),
          dayOffset: dashboardDueDayOffset(bill.dueDate, now),
          href: "/expenses?view=vendor-bills",
        };
      }),
      ...invoices.map((invoice): FinanceDashboardCashDueItem | null => {
        const paidAmount = invoice.payments.reduce(
          (sum, payment) => sum + Number(payment.amountPaid),
          0,
        );
        const outstanding = outstandingAmount(
          Number(invoice.amount),
          paidAmount,
          invoice.status,
        );
        if (outstanding <= 0) return null;
        return {
          id: invoice.id,
          type: "receivable",
          amount: Number(invoice.amount),
          paidAmount,
          outstandingAmount: outstanding,
          dueDate: invoice.dueDate,
          projectName: invoice.project?.name ?? "Proyek Tidak Dikenal",
          counterpartyName: "Client",
          documentNumber: invoice.invoiceNumber,
          status: invoice.status,
          bucket: resolveDashboardDueBucket(invoice.dueDate, now),
          dayOffset: dashboardDueDayOffset(invoice.dueDate, now),
          href: `/projects/${invoice.projectId}?tab=payments`,
        };
      }),
    ]
      .filter((item): item is FinanceDashboardCashDueItem => item !== null)
      .sort((a, b) => a.dayOffset - b.dayOffset || a.dueDate.getTime() - b.dueDate.getTime());

    const materialIssues: FinanceDashboardMaterialIssue[] = [
      ...liveRapItems.map((item): FinanceDashboardMaterialIssue | null => {
        const available =
          item.material?.inventory.reduce(
            (sum, inventory) =>
              sum +
              Number(inventory.currentStock) -
              Number(inventory.reservedStock),
            0,
          ) ?? 0;
        const required = Number(item.totalQuantity);
        if (required <= available) return null;
        return {
          id: `rap-${item.id}`,
          type: "RAP_SHORTAGE",
          severity: available <= 0 ? "CRITICAL" : "WARNING",
          materialName: item.material?.name ?? item.name,
          projectName: item.rap.project?.name ?? "Proyek Tidak Dikenal",
          locationName: null,
          availableStock: available,
          requiredStock: required,
          minimumStock: null,
          quantity: required - available,
          createdAt: null,
          unit: item.material?.unit ?? item.unit,
          description: `${item.name} membutuhkan ${(required - available).toLocaleString("id-ID")} ${item.material?.unit ?? item.unit} tambahan.`,
          href: `/projects/${item.rap.projectId}?tab=stok`,
        };
      }),
      ...inventoryRows.map((item): FinanceDashboardMaterialIssue | null => {
        const available =
          Number(item.currentStock) - Number(item.reservedStock);
        const minimum = Number(item.minimumStock);
        if (available > minimum) return null;
        return {
          id: `stock-${item.id}`,
          type: "LOW_STOCK",
          severity: available <= 0 ? "CRITICAL" : "WARNING",
          materialName: item.material?.name ?? "Material",
          projectName: null,
          locationName: item.location?.name ?? "Lokasi",
          availableStock: available,
          requiredStock: null,
          minimumStock: minimum,
          quantity: null,
          createdAt: null,
          unit: item.material?.unit ?? "unit",
          description: `Stok tersedia ${available.toLocaleString("id-ID")} ${item.material?.unit ?? "unit"} di ${item.location?.name ?? "lokasi"}.`,
          href: "/materials?tab=inventory",
        };
      }),
      ...reversalReceipts.map((receipt): FinanceDashboardMaterialIssue => ({
        id: `receipt-${receipt.id}`,
        type: "REVERSAL_REQUEST",
        severity: "WARNING",
        materialName: receipt.receiptNumber,
        projectName: receipt.project?.name ?? "Proyek Tidak Dikenal",
        locationName: receipt.inventoryLocation?.name ?? "Lokasi",
        availableStock: 0,
        requiredStock: null,
        minimumStock: null,
        quantity: null,
        createdAt: receipt.createdAt,
        unit: "",
        description: receipt.reversalReason ?? "Penerimaan material menunggu keputusan reversal.",
        href: "/materials?tab=overview",
      })),
      ...materialMovements.map((movement): FinanceDashboardMaterialIssue => ({
        id: `movement-${movement.id}`,
        type: movement.movementType === "WASTE" ? "WASTE" : "ADJUSTMENT",
        severity: movement.movementType === "WASTE" ? "WARNING" : "INFO",
        materialName: movement.material?.name ?? "Material",
        projectName: movement.project?.name ?? null,
        locationName: movement.location?.name ?? "Lokasi",
        availableStock: 0,
        requiredStock: null,
        minimumStock: null,
        quantity: Number(movement.quantity),
        createdAt: movement.createdAt,
        unit: movement.material?.unit ?? "unit",
        description: movement.note ?? (movement.movementType === "WASTE" ? "Material terbuang tercatat." : "Penyesuaian stok tercatat."),
        href: "/materials?tab=activity",
      })),
    ]
      .filter((item): item is FinanceDashboardMaterialIssue => item !== null)
      .sort((a, b) => {
        const rank = (severity: FinanceDashboardMaterialIssue["severity"]): number => severity === "CRITICAL" ? 2 : severity === "WARNING" ? 1 : 0;
        return rank(b.severity) - rank(a.severity)
          || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      });

    const projectInputs: DashboardProjectInput[] = budgets.map((budget) => ({
      projectId: budget.projectId,
      projectName: budget.project.name,
      financialHealth: budget.project.financialHealth,
      contractValue: Number(budget.contractValue),
      internalBudget: Number(budget.internalBudget),
      targetGrossAmount: Number(budget.targetGrossAmount),
      categories: budget.categories.map((category) => ({
        code: toCategoryCode(category.expenseCategory.code),
        name: category.expenseCategory.name,
        allocatedAmount: Number(category.allocatedAmount),
        pendingAmount: Number(category.pendingAmount),
        actualAmount: Number(category.actualAmount),
        paidAmount: Number(category.paidAmount),
        sortOrder: category.sortOrder,
      })),
    }));

    const core = buildFinanceDashboardCore({
      role,
      cashAvailable: accounts.reduce(
        (sum, account) => sum + Number(account.balance),
        0,
      ),
      receivables: invoices.map((invoice) => ({
        amount: Number(invoice.amount),
        paidAmount: invoice.payments.reduce(
          (sum, payment) => sum + Number(payment.amountPaid),
          0,
        ),
        status: invoice.status,
        dueDate: invoice.dueDate,
      })),
      payables: bills.map((bill) => ({
        amount: Number(bill.amount),
        paidAmount: bill.payments
          .filter((payment) => payment.status === "COMPLETED")
          .reduce((sum, payment) => sum + Number(payment.amountPaid), 0),
        status: bill.status,
        dueDate: bill.dueDate,
      })),
      projects: projectInputs,
      pendingApprovals: pendingApprovalCount,
      materialShortageCount,
      lowStockCount,
      now,
    });

    return {
      success: true,
      data: {
        role,
        generatedAt: now,
        dataQuality: {
          partial: unavailableSources.length > 0,
          unavailableSources,
        },
        ...core,
        bankAccounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          holderName: account.holderName,
          balance: Number(account.balance),
          cardColorFrom: account.cardColorFrom,
          cardColorTo: account.cardColorTo,
          cardTextColor: account.cardTextColor === "dark" ? "dark" : "light",
          isActive: account.isActive,
          recentTransactions: account.cashTransactions.map((transaction) => ({
            id: transaction.id,
            bankAccountId: transaction.bankAccountId,
            type: transaction.type,
            category: transaction.category,
            description: transaction.description,
            amount: Number(transaction.amount),
            reconciled: transaction.reconciled,
            createdAt: transaction.createdAt,
          })),
        })),
        dashboardTabs: {
          ...core.dashboardTabs,
          counts: {
            ...core.dashboardTabs.counts,
            accounts: 0,
            materials: core.dashboardTabs.counts.materials + reversalReceipts.length,
          },
        },
        dashboardDetails: {
          approvals: limitDashboardTabDetails(
            rankedApprovalDetails,
            DASHBOARD_TAB_DETAIL_LIMIT,
          ),
          cashDue: limitDashboardTabDetails(
            cashDue,
            DASHBOARD_TAB_DETAIL_LIMIT,
          ),
          cashDueGroups: buildCashDueGroups(cashDue),
          budgetRisks: limitDashboardTabDetails(
            core.riskyProjects,
            DASHBOARD_TAB_DETAIL_LIMIT,
          ),
          materials: limitDashboardTabDetails(
            materialIssues,
            DASHBOARD_TAB_DETAIL_LIMIT,
          ),
        },
        stockIssues: {
          materialShortageCount,
          lowStockCount,
          totalStockValue,
          reusableStockValue,
        },
        recentTransactions: transactions.map((transaction) => ({
          id: transaction.id,
          bankAccountId: transaction.bankAccountId,
          type: transaction.type,
          category: transaction.category,
          description: transaction.description,
          amount: Number(transaction.amount),
          reconciled: transaction.reconciled,
          createdAt: transaction.createdAt,
        })),
      },
    };
  } catch (error) {
    console.error("Failed to build finance dashboard overview:", error);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Gagal memuat ringkasan dashboard.",
      },
    };
  }
}
