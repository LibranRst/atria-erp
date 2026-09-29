import { actorCan } from "@/lib/auth/permissions";
import { getApprovalThresholds } from "@/lib/finance/approval-thresholds";
import { thresholdCentsToRupiah } from "@atria/core/finance/approval-thresholds";
import "server-only";

import { and, desc, eq, inArray, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  approval,
  bankAccount,
  materialMaster,
  project,
  projectCost,
  vendor,
  vendorBill,
  vendorPayment,
} from "@/db/schema";
import type {
  BankAccountItem,
  ExpenseCostItem,
  VendorListBill,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@atria/core/types/expenses";
import { getPendingApprovalDetails } from "@/lib/finance/approval-details";

import type { Actor } from "@/server/actor";
import {
  canExposeExpenseBankAccounts,
  redactExpensePaymentBankData,
} from "@/features/expenses/utils/expenses-access";

export type ExpensesPageReadyData = {
  readonly status: "ready";
  readonly initialCosts: ExpenseCostItem[];
  readonly bankAccounts: BankAccountItem[];
  /**
   * Ambang persetujuan Owner dalam rupiah, dibaca server dari konfigurasi.
   * Klien memakainya untuk menjelaskan konsekuensi sebelum submit — bukan untuk
   * memutuskan sendiri, karena keputusannya tetap milik server.
   */
  readonly vendorPaymentApprovalThreshold: number;
  readonly userRole: string;
  readonly vendorBills: VendorListBill[];
  readonly vendorPayments: VendorListPayment[];
  readonly vendors: VendorListVendor[];
  readonly projects: VendorListProject[];
  readonly pendingApprovalsCount: number;
};

/**
 * Loader melaporkan status, bukan melakukan `redirect()`. `redirect()` adalah
 * control-flow throw milik Next dan tidak bisa dipakai dari prosedur tRPC —
 * pemanggil web yang menerjemahkan `restricted` menjadi redirect.
 */
export type ExpensesPageData = ExpensesPageReadyData | { readonly status: "restricted" };

function toExpenseCostStatus(status: string): ExpenseCostItem["status"] {
  switch (status) {
    case "SUBMITTED":
    case "VERIFIED":
    case "APPROVED":
    case "REJECTED":
    case "PAID":
      return status;
    default:
      throw new Error(`Status pengajuan biaya tidak dikenal: ${status}`);
  }
}

export async function getExpensesPageData(actor: Actor): Promise<ExpensesPageData> {
  const roleName = actor.roleName ?? "UNKNOWN";
  /*
   * Tiga pertanyaan, tiga izin — bukan tiga nama peran.
   *
   * `isScopedToOwnWork` adalah cakupan data, `isFinanceOperator` adalah hak
   * melihat rekening, dan `canViewCosts` adalah hak melihat biaya lapangan.
   * Peran gudang lolos ke halaman ini lewat tagihan vendor, bukan lewat biaya
   * lapangan — itulah kenapa daftar biayanya kosong, dan sekarang alasannya
   * tertulis alih-alih tersembunyi di balik satu nama peran.
   */
  const isScopedToOwnWork = actor.dataScope === "ASSIGNED";
  const isFinanceOperator = canExposeExpenseBankAccounts(actor.permissions);
  const canViewCosts = actor.dataScope !== "NONE" && actorCan(actor, "view:cost");
  const canViewVendorBills = actorCan(actor, "view:vendor_bill");
  if (!canViewCosts && !canViewVendorBills) return { status: "restricted" };

  const isPM = isScopedToOwnWork;
  const costFilter = !canViewCosts
    ? eq(projectCost.id, "00000000-0000-0000-0000-000000000000")
    : isScopedToOwnWork
      ? eq(projectCost.requestedById, actor.userId)
      : undefined;

  const costsData = await db.query.projectCost.findMany({
    where: costFilter,
    with: {
      project: true,
      budgetCategory: {
        with: {
          expenseCategory: true,
        },
      },
      budgetItem: {
        with: {
          costCategory: true,
        },
      },
      requestedBy: true,
    },
    orderBy: [desc(projectCost.createdAt)],
  });

  let vendorBillFilter: SQL | undefined = canViewVendorBills
    ? undefined
    : eq(vendorBill.id, "00000000-0000-0000-0000-000000000000");
  let vendorPaymentFilter: SQL | undefined = canViewVendorBills
    ? undefined
    : eq(vendorPayment.id, "00000000-0000-0000-0000-000000000000");

  if (isPM && canViewVendorBills) {
    const pmProjects = await db.query.project.findMany({
      where: eq(project.projectManagerId, actor.userId),
      columns: { id: true },
    });
    const pmProjectIds = pmProjects.map((row) => row.id);

    if (pmProjectIds.length > 0) {
      vendorBillFilter = inArray(vendorBill.projectId, pmProjectIds);

      const pmBills = await db.query.vendorBill.findMany({
        where: inArray(vendorBill.projectId, pmProjectIds),
        columns: { id: true },
      });
      const pmBillIds = pmBills.map((row) => row.id);
      vendorPaymentFilter =
        pmBillIds.length > 0
          ? inArray(vendorPayment.vendorBillId, pmBillIds)
          : eq(vendorPayment.id, "00000000-0000-0000-0000-000000000000");
    } else {
      vendorBillFilter = eq(vendorBill.id, "00000000-0000-0000-0000-000000000000");
      vendorPaymentFilter = eq(vendorPayment.id, "00000000-0000-0000-0000-000000000000");
    }
  }

  const vendorBillsData = await db.query.vendorBill.findMany({
    where: vendorBillFilter,
    with: {
      project: true,
      vendor: true,
      budgetItem: {
        with: {
          costCategory: true,
        },
      },
      payments: {
        with: isFinanceOperator ? { bankAccount: { columns: { name: true } } } : undefined,
      },
    },
    orderBy: [desc(vendorBill.createdAt)],
  });

  const vendorPaymentsData = await db.query.vendorPayment.findMany({
    where: vendorPaymentFilter,
    with: {
      vendorBill: {
        with: {
          project: true,
          vendor: true,
          budgetItem: {
            with: {
              costCategory: true,
            },
          },
        },
      },
      bankAccount: isFinanceOperator ? { columns: { name: true } } : undefined,
      paidBy: true,
    },
    orderBy: [desc(vendorPayment.createdAt)],
  });

  const vendorPaymentsApprovals = await db.query.approval.findMany({
    where: eq(approval.referenceType, "vendor_payment"),
  });

  const paymentsForList = vendorPaymentsData.map((pay) => {
    const approvalRecord = vendorPaymentsApprovals.find((record) => record.referenceId === pay.id);
    return redactExpensePaymentBankData(
      {
        ...pay,
        approvalStatus: approvalRecord ? approvalRecord.status : "APPROVED",
      },
      isFinanceOperator,
    );
  });

  const billsForList = vendorBillsData.map((bill) => ({
    ...bill,
    payments: bill.payments.map((payment) =>
      redactExpensePaymentBankData(payment, isFinanceOperator),
    ),
  }));

  const bankAccountsData = isFinanceOperator
    ? await db.query.bankAccount.findMany({ where: eq(bankAccount.isActive, true) })
    : [];

  const vendorsData = await db.query.vendor.findMany({
    orderBy: [desc(vendor.name)],
  });

  const pmProjectFilter = isPM ? eq(project.projectManagerId, actor.userId) : undefined;
  const projectsData = await db.query.project.findMany({
    where: pmProjectFilter
      ? and(eq(project.status, "ACTIVE"), pmProjectFilter)
      : eq(project.status, "ACTIVE"),
    with: {
      budget: {
        with: {
          items: {
            with: {
              costCategory: true,
            },
          },
        },
      },
      canonicalBudgets: {
        with: {
          categories: {
            with: {
              expenseCategory: true,
            },
          },
        },
      },
      raps: {
        with: {
          items: true,
        },
      },
      categoryPlanItems: {
        with: {
          expenseCategory: true,
        },
      },
    },
  });

  const materialOptionsData = await db.query.materialMaster.findMany({
    where: eq(materialMaster.isActive, true),
    with: {
      inventory: true,
    },
  });
  const materialOptions = materialOptionsData.map((material) => ({
    id: material.id,
    name: material.name,
    unit: material.unit,
    availableStock: material.inventory.reduce((sum, inventory) => {
      return sum + Number(inventory.currentStock) - Number(inventory.reservedStock);
    }, 0),
  }));

  const costsForList: ExpenseCostItem[] = costsData.map((cost) => ({
    ...cost,
    status: toExpenseCostStatus(cost.status),
  }));

  const projectsForForms: VendorListProject[] = projectsData.map((row) => ({
    id: row.id,
    name: row.name,
    budget: row.budget,
    canonicalBudgets: row.canonicalBudgets.map((budget) => ({
      id: budget.id,
      status: budget.status,
      categories: budget.categories.map((category) => ({
        id: category.id,
        code: category.expenseCategory.code,
        name: category.expenseCategory.name,
        allocatedAmount: category.allocatedAmount,
        pendingAmount: category.pendingAmount,
        actualAmount: category.actualAmount,
        paidAmount: category.paidAmount,
        remainingAmount: category.remainingAmount,
        usedPercentage: category.usedPercentage,
        status: category.status,
        sortOrder: category.sortOrder,
      })),
    })),
    materialOptions,
    rapItems: row.raps.flatMap((rap) =>
      rap.items.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        label: item.name,
        area: item.area,
        quantity: item.totalQuantity,
        unit: item.unit,
        status: item.status,
      })),
    ),
    categoryPlanItems: row.categoryPlanItems.map((item) => ({
      id: item.id,
      projectBudgetCategoryId: item.projectBudgetCategoryId,
      expenseCategoryCode: item.expenseCategory.code,
      label: item.name,
      area: item.area,
      quantity: item.quantity,
      unit: item.unit,
      estimatedTotalCost: item.estimatedTotalCost,
      status: item.status,
    })),
  }));

  // Hitungan ini adalah "berapa yang menunggu keputusan Anda", jadi ia
  // mengikuti hak memutuskan seluruh antrean, bukan sekadar melihatnya.
  const pendingApprovalsCount = actorCan(actor, "decide:all_approvals")
    ? (await getPendingApprovalDetails()).length
    : 0;

  return {
    status: "ready",
    initialCosts: costsForList,
    bankAccounts: bankAccountsData,
    userRole: roleName,
    vendorBills: billsForList,
    vendorPayments: paymentsForList,
    vendors: vendorsData,
    projects: projectsForForms,
    pendingApprovalsCount,
    vendorPaymentApprovalThreshold: thresholdCentsToRupiah(
      (await getApprovalThresholds()).vendorPaymentCents,
    ),
  };
}
