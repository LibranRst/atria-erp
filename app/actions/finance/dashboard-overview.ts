"use server";

import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiRun, approval, cashTransaction, project } from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { getPendingApprovalDetails } from "@/lib/finance/approval-details";
import {
  buildFinanceDashboardCore,
  DASHBOARD_TAB_DETAIL_LIMIT,
  limitDashboardTabDetails,
  type DashboardProjectInput,
  type DashboardRole,
} from "@/lib/finance/dashboard-overview";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  outstandingAmount,
  parseAiInsight,
  toCategoryCode,
  type FinanceDashboardCashDueItem,
  type FinanceDashboardMaterialIssue,
  type FinanceDashboardOverview,
} from "./dashboard-overview-utils";

export type {
  FinanceDashboardBankAccount,
  FinanceDashboardCashDueItem,
  FinanceDashboardMaterialIssue,
  FinanceDashboardOverview,
  FinanceDashboardRecentTransaction,
  FinanceDashboardTabDetails,
} from "./dashboard-overview-utils";

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
    const [
      accounts,
      invoices,
      bills,
      pendingApprovalRecords,
      approvalDetails,
      inventoryRows,
      rapItems,
      transactions,
      latestBriefing,
      budgets,
    ] = await Promise.all([
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
      role === "OWNER"
        ? db.query.approval.findMany({ where: eq(approval.status, "PENDING") })
        : Promise.resolve([]),
      role === "OWNER"
        ? getPendingApprovalDetails(DASHBOARD_TAB_DETAIL_LIMIT)
        : Promise.resolve([]),
      db.query.materialInventory.findMany({
        with: { material: true, location: true },
      }),
      db.query.projectRapItem.findMany({
        with: {
          rap: { with: { project: true } },
          material: { with: { inventory: true } },
        },
      }),
      db.query.cashTransaction.findMany({
        orderBy: [desc(cashTransaction.createdAt)],
        limit: 5,
      }),
      db.query.aiRun.findFirst({
        where: and(
          eq(aiRun.runType, "FINANCIAL_BRIEFING"),
          eq(aiRun.status, "COMPLETED"),
        ),
        orderBy: [desc(aiRun.createdAt)],
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
    const pendingApprovalCount = pendingApprovalRecords.filter(
      (item) =>
        item.referenceType === "project_cost" ||
        item.referenceType === "vendor_payment",
    ).length;

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
    const now = new Date();
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
        if (outstanding <= 0 || bill.dueDate >= now) return null;
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
        if (outstanding <= 0 || invoice.dueDate >= now) return null;
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
          href: `/projects/${invoice.projectId}?tab=payments`,
        };
      }),
    ]
      .filter((item): item is FinanceDashboardCashDueItem => item !== null)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

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
          unit: item.material?.unit ?? "unit",
          description: `Stok tersedia ${available.toLocaleString("id-ID")} ${item.material?.unit ?? "unit"} di ${item.location?.name ?? "lokasi"}.`,
          href: "/materials?tab=inventory",
        };
      }),
    ]
      .filter((item): item is FinanceDashboardMaterialIssue => item !== null)
      .sort((a, b) =>
        a.severity === b.severity ? 0 : a.severity === "CRITICAL" ? -1 : 1,
      );

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
            createdAt: transaction.createdAt,
          })),
        })),
        dashboardTabs: {
          ...core.dashboardTabs,
          counts: {
            ...core.dashboardTabs.counts,
            accounts: accounts.length,
          },
        },
        dashboardDetails: {
          approvals: limitDashboardTabDetails(
            approvalDetails,
            DASHBOARD_TAB_DETAIL_LIMIT,
          ),
          cashDue: limitDashboardTabDetails(
            cashDue,
            DASHBOARD_TAB_DETAIL_LIMIT,
          ),
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
          createdAt: transaction.createdAt,
        })),
        aiInsight: latestBriefing
          ? parseAiInsight(latestBriefing.result, latestBriefing.createdAt)
          : null,
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
