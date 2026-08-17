import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { approval, inventoryOpeningBatch, projectCost, vendorPayment } from "@/db/schema";
import type {
  ApprovalDetail,
  FinanceApprovalDetail,
  InventoryOpeningApprovalDetail,
} from "@atria/core/finance/approval-types";
import { dashboardDueDayOffset } from "@atria/core/finance/dashboard-overview";
import { resolveRoleName } from "@/lib/auth/permissions";
import { getServerSession } from "@/lib/server/session";

type ApprovalRecord = typeof approval.$inferSelect;

export type ProjectCostApprovalSource = {
  readonly approval: ApprovalRecord;
  readonly cost: typeof projectCost.$inferSelect & {
    readonly project?: { readonly name: string } | null;
    readonly budgetItem?: {
      readonly name: string;
      readonly allocatedAmount: string | number;
      readonly actualSpent: string | number;
    } | null;
    readonly budgetCategory?: {
      readonly allocatedAmount: string | number;
      readonly actualAmount: string | number;
      readonly expenseCategory: { readonly name: string };
    } | null;
    readonly requestedBy?: { readonly name: string } | null;
  };
};

export type VendorPaymentApprovalSource = {
  readonly approval: ApprovalRecord;
  readonly payment: typeof vendorPayment.$inferSelect & {
    readonly vendorBill?: {
      readonly billNumber: string;
      readonly dueDate?: Date;
      readonly notes: string | null;
      readonly project?: { readonly name: string } | null;
      readonly vendor?: { readonly name: string } | null;
      readonly budgetItem?: {
        readonly name: string;
        readonly allocatedAmount: string | number;
        readonly actualSpent: string | number;
      } | null;
      readonly budgetCategory?: {
        readonly allocatedAmount: string | number;
        readonly actualAmount: string | number;
        readonly expenseCategory: { readonly name: string; readonly code?: string };
      } | null;
    } | null;
  };
};

export type InventoryOpeningApprovalSource = {
  readonly batch: {
    readonly id: string;
    readonly batchNumber: string;
    readonly createdAt: Date;
    readonly note: string;
    readonly requestedById: string;
    readonly requestedBy: { readonly name: string };
    readonly items: readonly {
      readonly id: string;
      readonly materialInventoryId: string;
      readonly quantity: string | number;
      readonly unitCost: string | number;
      readonly inventory: {
        readonly material: {
          readonly name: string;
          readonly unit: string;
        };
        readonly location: { readonly name: string };
      };
    }[];
  };
};

export function mapProjectCostApprovalDetail(
  input: ProjectCostApprovalSource,
  currentUserId?: string | null,
  isOwner?: boolean,
): FinanceApprovalDetail {
  const selfApproval = currentUserId ? input.cost.requestedById === currentUserId : false;
  const canEmergencyOverride = Boolean(isOwner && selfApproval);
  return {
    id: input.approval.id,
    createdAt: input.approval.createdAt,
    dueDate: null,
    notes: input.approval.notes,
    type: "project_cost",
    referenceId: input.approval.referenceId,
    amount: Number(input.cost.amount),
    description: input.cost.description,
    receiptImageUrl: input.cost.receiptImageUrl,
    projectName: input.cost.project?.name ?? "Proyek Tidak Dikenal",
    budgetItemName:
      input.cost.budgetCategory?.expenseCategory?.name ??
      input.cost.budgetItem?.name ??
      "Kategori Belum Ditentukan",
    allocatedAmount: Number(
      input.cost.budgetCategory?.allocatedAmount ?? input.cost.budgetItem?.allocatedAmount ?? 0,
    ),
    actualSpent: Number(
      input.cost.budgetCategory?.actualAmount ?? input.cost.budgetItem?.actualSpent ?? 0,
    ),
    requestedBy: input.cost.requestedBy?.name ?? "Project Manager",
    canEmergencyOverride,
    // Pengeluaran lapangan diakui sebagai realisasi kategori saat
    // verifikasi/approval, termasuk pengeluaran Material direct-use.
    consumesBudgetActual: true,
    budgetOverrun: input.cost.budgetOverrun,
    priority: input.cost.budgetOverrun ? "CRITICAL" : "NORMAL",
    priorityReason: input.cost.budgetOverrun ? "Melewati batas budget" : "Perlu keputusan Owner",
  };
}

export function mapVendorPaymentApprovalDetail(
  input: VendorPaymentApprovalSource,
  currentUserId?: string | null,
  isOwner?: boolean,
): FinanceApprovalDetail {
  const bill = input.payment.vendorBill;
  const selfApproval = currentUserId ? input.payment.paidById === currentUserId : false;
  const canEmergencyOverride = Boolean(isOwner && selfApproval);
  return {
    id: input.approval.id,
    createdAt: input.approval.createdAt,
    dueDate: bill?.dueDate ?? null,
    notes: input.approval.notes,
    type: "vendor_payment",
    referenceId: input.approval.referenceId,
    amount: Number(input.payment.amountPaid),
    description: bill?.notes ?? `Pembayaran Tagihan Vendor #${bill?.billNumber ?? "-"}`,
    receiptImageUrl: null,
    projectName: bill?.project?.name ?? "Proyek Tidak Dikenal",
    budgetItemName:
      bill?.budgetCategory?.expenseCategory?.name ??
      bill?.budgetItem?.name ??
      "Kategori Belum Ditentukan",
    allocatedAmount: Number(
      bill?.budgetCategory?.allocatedAmount ?? bill?.budgetItem?.allocatedAmount ?? 0,
    ),
    actualSpent: Number(bill?.budgetCategory?.actualAmount ?? bill?.budgetItem?.actualSpent ?? 0),
    requestedBy: bill?.vendor?.name ?? "Vendor Supplier",
    canEmergencyOverride,
    // Sejalan dengan `lib/finance/vendor-bill-write.ts`: kategori Material
    // menjadi INVENTORY_PURCHASE/INVENTORY_ASSET dan tidak dihitung sebagai
    // realisasi kategori oleh `syncProjectBudgetCategory`.
    consumesBudgetActual: bill?.budgetCategory?.expenseCategory?.code !== "MATERIAL",
    budgetOverrun: false,
    priority: "NORMAL",
    priorityReason: "Perlu keputusan Owner",
  };
}

export function mapInventoryOpeningApprovalDetail(
  input: InventoryOpeningApprovalSource,
): InventoryOpeningApprovalDetail {
  const inventoryItems = input.batch.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    return {
      id: item.id,
      materialInventoryId: item.materialInventoryId,
      materialName: item.inventory.material.name,
      locationName: item.inventory.location.name,
      unit: item.inventory.material.unit,
      quantity,
      unitCost,
      totalValue: quantity * unitCost,
    };
  });
  return {
    id: `inventory-opening-${input.batch.id}`,
    createdAt: input.batch.createdAt,
    dueDate: null,
    notes: input.batch.note,
    type: "inventory_opening",
    referenceId: input.batch.id,
    amount: inventoryItems.reduce((sum, item) => sum + item.totalValue, 0),
    description: `Saldo awal stok ${input.batch.batchNumber}`,
    receiptImageUrl: null,
    projectName: "Inventory perusahaan",
    budgetItemName: `${inventoryItems.length} item stok`,
    allocatedAmount: 0,
    actualSpent: 0,
    requestedBy: input.batch.requestedBy.name,
    canEmergencyOverride: false,
    consumesBudgetActual: false,
    budgetOverrun: false,
    priority: "NORMAL",
    priorityReason: "Perlu persetujuan saldo stok",
    inventoryItems,
  };
}

function approvalUrgency(item: ApprovalDetail, now: Date): number {
  if (!item.dueDate) return 0;
  const offset = dashboardDueDayOffset(item.dueDate, now);
  if (offset < 0) return 3;
  if (offset === 0) return 2;
  if (offset <= 7) return 1;
  return 0;
}

export function rankPendingApprovals(
  approvals: readonly ApprovalDetail[],
  now: Date,
): readonly ApprovalDetail[] {
  return approvals
    .map((item): ApprovalDetail => {
      const urgency = approvalUrgency(item, now);
      const waitingDays = Math.max(0, -dashboardDueDayOffset(item.createdAt, now));
      if (item.budgetOverrun) {
        return {
          ...item,
          priority: "CRITICAL",
          priorityReason: "Melewati batas budget",
        };
      }
      if (urgency === 3) {
        const lateDays = Math.max(1, -dashboardDueDayOffset(item.dueDate ?? now, now));
        return {
          ...item,
          priority: "CRITICAL",
          priorityReason: `Jatuh tempo ${lateDays} hari lalu`,
        };
      }
      if (urgency === 2) {
        return {
          ...item,
          priority: "WARNING",
          priorityReason: "Jatuh tempo hari ini",
        };
      }
      if (urgency === 1) {
        return {
          ...item,
          priority: "WARNING",
          priorityReason: "Jatuh tempo dalam 7 hari",
        };
      }
      if (waitingDays >= 3) {
        return {
          ...item,
          priority: "WARNING",
          priorityReason: `Menunggu ${waitingDays} hari`,
        };
      }
      if (item.amount >= 5_000_000) {
        return {
          ...item,
          priority: "WARNING",
          priorityReason: "Nominal perlu perhatian",
        };
      }
      return item;
    })
    .sort((a, b) => {
      const rank = (value: ApprovalDetail["priority"]): number =>
        value === "CRITICAL" ? 2 : value === "WARNING" ? 1 : 0;
      return (
        Number(b.budgetOverrun) - Number(a.budgetOverrun) ||
        rank(b.priority) - rank(a.priority) ||
        approvalUrgency(b, now) - approvalUrgency(a, now) ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        b.amount - a.amount
      );
    });
}

export async function resolveApprovalDetail(
  record: ApprovalRecord,
  currentUserId?: string | null,
  isOwner?: boolean,
): Promise<ApprovalDetail | null> {
  if (record.referenceType === "project_cost") {
    const cost = await db.query.projectCost.findFirst({
      where: eq(projectCost.id, record.referenceId),
      with: {
        project: true,
        budgetItem: true,
        budgetCategory: {
          with: {
            expenseCategory: true,
          },
        },
        requestedBy: true,
      },
    });

    if (!cost || cost.status !== "VERIFIED") return null;
    return mapProjectCostApprovalDetail({ approval: record, cost }, currentUserId, isOwner);
  }

  if (record.referenceType === "vendor_payment") {
    const payment = await db.query.vendorPayment.findFirst({
      where: eq(vendorPayment.id, record.referenceId),
      with: {
        vendorBill: {
          with: {
            project: true,
            vendor: true,
            budgetItem: true,
            budgetCategory: {
              with: {
                expenseCategory: true,
              },
            },
          },
        },
      },
    });

    if (!payment?.vendorBill) return null;
    return mapVendorPaymentApprovalDetail({ approval: record, payment }, currentUserId, isOwner);
  }

  return null;
}

export async function getPendingApprovalDetails(
  limit?: number,
): Promise<readonly ApprovalDetail[]> {
  const session = await getServerSession();
  const currentUserId = session?.user?.id ?? null;
  const roleName = session?.user?.roleId ? await resolveRoleName(session.user.roleId) : null;
  const isOwner = roleName === "OWNER";

  const records = await db.query.approval.findMany({
    where: eq(approval.status, "PENDING"),
    orderBy: [desc(approval.createdAt)],
  });
  const details: ApprovalDetail[] = [];

  for (const record of records) {
    let detail: ApprovalDetail | null = null;
    try {
      detail = await resolveApprovalDetail(record, currentUserId, isOwner);
    } catch (error) {
      console.warn("Skipping invalid pending approval detail", {
        approvalId: record.id,
        referenceType: record.referenceType,
        error,
      });
      continue;
    }
    if (!detail) continue;
    details.push(detail);
    if (typeof limit === "number" && details.length >= limit) break;
  }

  const openingBatches = await db.query.inventoryOpeningBatch.findMany({
    where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
    with: {
      requestedBy: { columns: { name: true } },
      items: {
        with: {
          inventory: {
            columns: { id: true },
            with: {
              material: { columns: { name: true, unit: true } },
              location: { columns: { name: true } },
            },
          },
        },
      },
    },
    orderBy: (table, { desc: descending }) => [descending(table.createdAt)],
  });
  for (const batch of openingBatches) {
    details.push(mapInventoryOpeningApprovalDetail({ batch }));
  }

  return details.slice(0, limit ?? details.length);
}
