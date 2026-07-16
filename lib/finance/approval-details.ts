import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { approval, projectCost, vendorPayment } from "@/db/schema";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { dashboardDueDayOffset } from "@/lib/finance/dashboard-overview";

type ApprovalRecord = typeof approval.$inferSelect;

export type ProjectCostApprovalSource = {
  readonly approval: ApprovalRecord;
  readonly cost: typeof projectCost.$inferSelect & {
    readonly project?: { readonly name: string } | null;
    readonly budgetItem?: { readonly name: string; readonly allocatedAmount: string | number; readonly actualSpent: string | number } | null;
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
      readonly budgetItem?: { readonly name: string; readonly allocatedAmount: string | number; readonly actualSpent: string | number } | null;
    } | null;
  };
};

export function mapProjectCostApprovalDetail(input: ProjectCostApprovalSource): ApprovalDetail {
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
    budgetItemName: input.cost.budgetItem?.name ?? "Kategori Belum Ditentukan",
    allocatedAmount: Number(input.cost.budgetItem?.allocatedAmount ?? 0),
    actualSpent: Number(input.cost.budgetItem?.actualSpent ?? 0),
    requestedBy: input.cost.requestedBy?.name ?? "Project Manager",
    budgetOverrun: input.cost.budgetOverrun,
    priority: input.cost.budgetOverrun ? "CRITICAL" : "NORMAL",
    priorityReason: input.cost.budgetOverrun ? "Melewati batas budget" : "Perlu keputusan Owner",
  };
}

export function mapVendorPaymentApprovalDetail(input: VendorPaymentApprovalSource): ApprovalDetail {
  const bill = input.payment.vendorBill;
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
    budgetItemName: bill?.budgetItem?.name ?? "Kategori Belum Ditentukan",
    allocatedAmount: Number(bill?.budgetItem?.allocatedAmount ?? 0),
    actualSpent: Number(bill?.budgetItem?.actualSpent ?? 0),
    requestedBy: bill?.vendor?.name ?? "Vendor Supplier",
    budgetOverrun: false,
    priority: "NORMAL",
    priorityReason: "Perlu keputusan Owner",
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
  return approvals.map((item): ApprovalDetail => {
    const urgency = approvalUrgency(item, now);
    const waitingDays = Math.max(0, -dashboardDueDayOffset(item.createdAt, now));
    if (item.budgetOverrun) {
      return { ...item, priority: "CRITICAL", priorityReason: "Melewati batas budget" };
    }
    if (urgency === 3) {
      const lateDays = Math.max(1, -dashboardDueDayOffset(item.dueDate ?? now, now));
      return { ...item, priority: "CRITICAL", priorityReason: `Jatuh tempo ${lateDays} hari lalu` };
    }
    if (urgency === 2) {
      return { ...item, priority: "WARNING", priorityReason: "Jatuh tempo hari ini" };
    }
    if (urgency === 1) {
      return { ...item, priority: "WARNING", priorityReason: "Jatuh tempo dalam 7 hari" };
    }
    if (waitingDays >= 3) {
      return { ...item, priority: "WARNING", priorityReason: `Menunggu ${waitingDays} hari` };
    }
    if (item.amount >= 5_000_000) {
      return { ...item, priority: "WARNING", priorityReason: "Nominal perlu perhatian" };
    }
    return item;
  }).sort((a, b) => {
    const rank = (value: ApprovalDetail["priority"]): number => value === "CRITICAL" ? 2 : value === "WARNING" ? 1 : 0;
    return Number(b.budgetOverrun) - Number(a.budgetOverrun)
      || rank(b.priority) - rank(a.priority)
      || approvalUrgency(b, now) - approvalUrgency(a, now)
      || a.createdAt.getTime() - b.createdAt.getTime()
      || b.amount - a.amount;
  });
}

export async function resolveApprovalDetail(record: ApprovalRecord): Promise<ApprovalDetail | null> {
  if (record.referenceType === "project_cost") {
    const cost = await db.query.projectCost.findFirst({
      where: eq(projectCost.id, record.referenceId),
      with: {
        project: true,
        budgetItem: true,
        requestedBy: true,
      },
    });

    if (!cost || cost.status !== "VERIFIED") return null;
    return mapProjectCostApprovalDetail({ approval: record, cost });
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
          },
        },
      },
    });

    if (!payment?.vendorBill) return null;
    return mapVendorPaymentApprovalDetail({ approval: record, payment });
  }

  return null;
}

export async function getPendingApprovalDetails(limit?: number): Promise<readonly ApprovalDetail[]> {
  const records = await db.query.approval.findMany({
    where: eq(approval.status, "PENDING"),
    orderBy: [desc(approval.createdAt)],
  });
  const details: ApprovalDetail[] = [];

  for (const record of records) {
    let detail: ApprovalDetail | null = null;
    try {
      detail = await resolveApprovalDetail(record);
    } catch (error) {
      console.warn("Skipping invalid pending approval detail", { approvalId: record.id, referenceType: record.referenceType, error });
      continue;
    }
    if (!detail) continue;
    details.push(detail);
    if (typeof limit === "number" && details.length >= limit) break;
  }

  return details;
}
