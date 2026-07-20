import { describe, expect, test } from "bun:test";

import {
  mapProjectCostApprovalDetail,
  mapInventoryOpeningApprovalDetail,
  mapVendorPaymentApprovalDetail,
  rankPendingApprovals,
  type InventoryOpeningApprovalSource,
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
      budgetItem: {
        name: "Material",
        allocatedAmount: "10000000.00",
        actualSpent: "3000000.00",
      },
      budgetCategory: {
        allocatedAmount: "15000000.00",
        actualAmount: "4500000.00",
        expenseCategory: { name: "Material canonical" },
      },
      requestedBy: { name: "Budi" },
    } satisfies ProjectCostApprovalSource["cost"];

    const detail = mapProjectCostApprovalDetail({
      approval: approvalRecord,
      cost,
    });

    expect(detail.type).toBe("project_cost");
    expect(detail.amount).toBe(7_500_000);
    expect(detail.projectName).toBe("Villa Kemang");
    expect(detail.budgetItemName).toBe("Material canonical");
    expect(detail.allocatedAmount).toBe(15_000_000);
    expect(detail.actualSpent).toBe(4_500_000);
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
        dueDate: new Date("2026-06-23T09:00:00.000Z"),
        notes: null,
        project: { name: "Office BSD" },
        vendor: { name: "CV Sumber Jaya" },
        budgetItem: {
          name: "Subcon",
          allocatedAmount: "12000000.00",
          actualSpent: "4000000.00",
        },
      },
    } satisfies VendorPaymentApprovalSource["payment"];

    const detail = mapVendorPaymentApprovalDetail({
      approval: paymentApproval,
      payment,
    });

    expect(detail.type).toBe("vendor_payment");
    expect(detail.amount).toBe(4_500_000);
    expect(detail.description).toBe("Pembayaran Tagihan Vendor #VB-001");
    expect(detail.projectName).toBe("Office BSD");
    expect(detail.requestedBy).toBe("CV Sumber Jaya");
    expect(detail.budgetOverrun).toBe(false);
    expect(detail.dueDate).toEqual(new Date("2026-06-23T09:00:00.000Z"));
  });

  test("maps every opening inventory item for checker review", () => {
    const batch = {
      id: "batch-1",
      batchNumber: "OPEN-2026-001",
      createdAt: new Date("2026-07-18T08:00:00.000Z"),
      note: "Hasil stock opname cutover",
      requestedById: "purchasing-1",
      requestedBy: { name: "Sari Purchasing" },
      items: [
        {
          id: "opening-item-1",
          materialInventoryId: "inventory-1",
          quantity: "12.50",
          unitCost: "80000.00",
          inventory: {
            material: { name: "Multiplek 18 mm", unit: "lembar" },
            location: { name: "Gudang Utama" },
          },
        },
        {
          id: "opening-item-2",
          materialInventoryId: "inventory-2",
          quantity: "4.00",
          unitCost: "150000.00",
          inventory: {
            material: { name: "HPL Putih", unit: "lembar" },
            location: { name: "Gudang Workshop" },
          },
        },
      ],
    } satisfies InventoryOpeningApprovalSource["batch"];

    const detail = mapInventoryOpeningApprovalDetail({ batch });

    expect(detail.amount).toBe(1_600_000);
    expect(detail.inventoryItems).toHaveLength(2);
    expect(detail.inventoryItems[0]).toEqual({
      id: "opening-item-1",
      materialInventoryId: "inventory-1",
      materialName: "Multiplek 18 mm",
      locationName: "Gudang Utama",
      unit: "lembar",
      quantity: 12.5,
      unitCost: 80_000,
      totalValue: 1_000_000,
    });
  });

  test("ranks budget overrun before overdue and nominal-only approvals", () => {
    const overrun = mapProjectCostApprovalDetail({
      approval: approvalRecord,
      cost: {
        id: "cost-priority",
        projectId: "project-1",
        projectBudgetItemId: null,
        projectBudgetCategoryId: "category-1",
        materialId: null,
        projectRapItemId: null,
        requestedById: "pm-1",
        receiptGroupId: null,
        quantity: "1",
        unitPrice: "6000000",
        amount: "6000000",
        description: "Biaya melewati budget",
        receiptImageUrl: null,
        status: "VERIFIED",
        budgetOverrun: true,
        bankAccountId: null,
        cashTransactionId: null,
        verifiedById: null,
        verifiedAt: null,
        approvedById: null,
        approvedAt: null,
        paidById: null,
        paidAt: null,
        createdAt: new Date("2026-06-24T06:00:00.000Z"),
        updatedAt: new Date("2026-06-24T07:00:00.000Z"),
      },
    });
    const overdue = {
      ...overrun,
      id: "overdue",
      budgetOverrun: false,
      dueDate: new Date("2026-06-20T00:00:00.000Z"),
      priority: "NORMAL" as const,
      priorityReason: "Perlu keputusan Owner",
    };
    const ranked = rankPendingApprovals(
      [overdue, overrun],
      new Date("2026-06-25T00:00:00.000Z"),
    );
    expect(ranked[0]?.id).toBe(overrun.id);
    expect(ranked[0]?.priorityReason).toBe("Melewati batas budget");
    expect(ranked[1]?.priority).toBe("CRITICAL");
  });
});
