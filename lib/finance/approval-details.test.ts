import { describe, expect, test } from "bun:test";

import {
  mapProjectCostApprovalDetail,
  mapVendorPaymentApprovalDetail,
  type ProjectCostApprovalSource,
  type VendorPaymentApprovalSource,
} from "./approval-details";

const approvalRecord = {
  id: "approval-1",
  approverId: "owner-1",
  referenceType: "project_cost",
  referenceId: "cost-1",
  status: "PENDING",
  notes: "Review owner",
  createdAt: new Date("2026-06-24T08:00:00.000Z"),
} satisfies ProjectCostApprovalSource["approval"];

describe("approval detail mapping", () => {
  test("maps project cost approvals into shared approval detail shape", () => {
    const cost = {
      id: "cost-1",
      projectId: "project-1",
      projectBudgetItemId: "budget-item-1",
      projectBudgetCategoryId: "budget-category-1",
      materialId: null,
      projectRapItemId: null,
      requestedById: "pm-1",
      receiptGroupId: null,
      quantity: "1.00",
      unitPrice: "7500000.00",
      amount: "7500000.00",
      description: "Pembelian material urgent",
      receiptImageUrl: "https://example.com/receipt.jpg",
      status: "VERIFIED",
      budgetOverrun: true,
      bankAccountId: null,
      cashTransactionId: null,
      verifiedById: "finance-1",
      verifiedAt: new Date("2026-06-24T07:00:00.000Z"),
      approvedById: null,
      approvedAt: null,
      paidById: null,
      paidAt: null,
      createdAt: new Date("2026-06-24T06:00:00.000Z"),
      updatedAt: new Date("2026-06-24T07:00:00.000Z"),
      project: { name: "Villa Kemang" },
      budgetItem: { name: "Material", allocatedAmount: "10000000.00", actualSpent: "3000000.00" },
      requestedBy: { name: "Budi" },
    } satisfies ProjectCostApprovalSource["cost"];

    const detail = mapProjectCostApprovalDetail({ approval: approvalRecord, cost });

    expect(detail.type).toBe("project_cost");
    expect(detail.amount).toBe(7_500_000);
    expect(detail.projectName).toBe("Villa Kemang");
    expect(detail.budgetItemName).toBe("Material");
    expect(detail.requestedBy).toBe("Budi");
    expect(detail.budgetOverrun).toBe(true);
  });

  test("maps vendor payment approvals into shared approval detail shape", () => {
    const paymentApproval = {
      ...approvalRecord,
      id: "approval-2",
      referenceType: "vendor_payment",
      referenceId: "payment-1",
    } satisfies VendorPaymentApprovalSource["approval"];
    const payment = {
      id: "payment-1",
      vendorBillId: "bill-1",
      bankAccountId: "bank-1",
      cashTransactionId: null,
      amountPaid: "4500000.00",
      status: "PENDING",
      paymentDate: new Date("2026-06-24T09:00:00.000Z"),
      paidById: "finance-1",
      referenceNumber: null,
      createdAt: new Date("2026-06-24T09:00:00.000Z"),
      vendorBill: {
        billNumber: "VB-001",
        notes: null,
        project: { name: "Office BSD" },
        vendor: { name: "CV Sumber Jaya" },
        budgetItem: { name: "Subcon", allocatedAmount: "12000000.00", actualSpent: "4000000.00" },
      },
    } satisfies VendorPaymentApprovalSource["payment"];

    const detail = mapVendorPaymentApprovalDetail({ approval: paymentApproval, payment });

    expect(detail.type).toBe("vendor_payment");
    expect(detail.amount).toBe(4_500_000);
    expect(detail.description).toBe("Pembayaran Tagihan Vendor #VB-001");
    expect(detail.projectName).toBe("Office BSD");
    expect(detail.requestedBy).toBe("CV Sumber Jaya");
    expect(detail.budgetOverrun).toBe(false);
  });
});
