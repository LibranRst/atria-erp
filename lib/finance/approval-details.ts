import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { approval, projectCost, vendorPayment } from "@/db/schema";
import type { ApprovalDetail } from "@/lib/finance/approval-types";

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
  };
}

export function mapVendorPaymentApprovalDetail(input: VendorPaymentApprovalSource): ApprovalDetail {
  const bill = input.payment.vendorBill;
  return {
    id: input.approval.id,
    createdAt: input.approval.createdAt,
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
  };
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
