import { expect, test } from "bun:test";
import type {
  ApprovalDetail,
  FinanceApprovalDetail,
  InventoryOpeningApprovalDetail,
} from "@atria/core/finance/approval-types";
import {
  approvalPriorityLabel,
  approvalQueueDate,
  approvalTypeLabel,
  filterDesktopApprovals,
} from "./approval-desktop";

function finance(overrides: Partial<FinanceApprovalDetail> = {}): FinanceApprovalDetail {
  return {
    id: "field-normal",
    referenceId: "cost-field",
    type: "project_cost",
    createdAt: new Date("2026-10-14T03:00:00.000Z"),
    dueDate: null,
    notes: null,
    amount: 275_000.25,
    description: "Transportasi material ke lokasi",
    receiptImageUrl: null,
    projectName: "Cipete House",
    budgetItemName: "Operasional",
    allocatedAmount: 90_000_000,
    actualSpent: 20_000_000,
    requestedBy: "Budi Santoso",
    consumesBudgetActual: true,
    budgetOverrun: false,
    priority: "NORMAL",
    priorityReason: "Perlu keputusan Owner",
    ...overrides,
  };
}

const stock: InventoryOpeningApprovalDetail = {
  ...finance(),
  id: "stock-opening",
  referenceId: "batch-stock",
  type: "inventory_opening",
  amount: 1_000_000.25,
  description: "Stock opname gudang",
  projectName: "Inventory perusahaan",
  budgetItemName: "1 item stok",
  requestedBy: "Sari Purchasing",
  allocatedAmount: 0,
  actualSpent: 0,
  budgetOverrun: false,
  consumesBudgetActual: false,
  inventoryItems: [],
};
const defaults = { query: "", type: "ALL", project: "", priority: "ALL" } as const;

test("Desktop filters combine normalized search, type, project and priority", () => {
  const selected = finance({ id: "field-warning", priority: "WARNING" });
  const rows: readonly ApprovalDetail[] = [
    finance(),
    selected,
    finance({ id: "other-project", projectName: "Menteng Villa", priority: "WARNING" }),
    finance({ id: "vendor", type: "vendor_payment", priority: "WARNING" }),
    stock,
  ];
  const filters = {
    query: "  BUDI  ",
    type: "FIELD",
    project: "Cipete House",
    priority: "WARNING",
  } as const;
  expect(filterDesktopApprovals(rows, filters)).toEqual([selected]);
  expect(filterDesktopApprovals(rows, { ...filters, project: "Proyek tidak tersedia" })).toEqual(
    [],
  );
  expect(filterDesktopApprovals(rows, { ...filters, priority: "CRITICAL" })).toEqual([]);
});

test("Critical filters and labels use the canonical impact helper rather than the raw priority", () => {
  const reachesBudget = finance({ id: "limit", amount: 10, allocatedAmount: 100, actualSpent: 90 });
  const stockPurchase = finance({
    id: "material-purchase",
    type: "vendor_payment",
    amount: 200,
    allocatedAmount: 100,
    actualSpent: 90,
    consumesBudgetActual: false,
  });
  const rows = [reachesBudget, stockPurchase, stock];
  expect(approvalPriorityLabel(reachesBudget)).toBe("Kritis");
  expect(filterDesktopApprovals(rows, { ...defaults, type: "CRITICAL" })).toEqual([reachesBudget]);
  expect(filterDesktopApprovals(rows, { ...defaults, priority: "NORMAL" })).toEqual([
    stockPurchase,
    stock,
  ]);
  expect(approvalPriorityLabel(stockPurchase)).toBe("Normal");
  expect(approvalPriorityLabel(stock)).toBe("Normal");
});

test("Filtering preserves source order, row identity and immutable supplied collections", () => {
  const first = Object.freeze(finance({ id: "first" }));
  const second = Object.freeze(finance({ id: "second" }));
  const rows = Object.freeze([first, second, Object.freeze(stock)]);
  const filtered = filterDesktopApprovals(rows, { ...defaults, type: "FIELD" });
  expect(filtered.map((item) => item.id)).toEqual(["first", "second"]);
  expect(filtered[0]).toBe(first);
  expect(filtered[1]).toBe(second);
  expect(rows.map((item) => item.id)).toEqual(["first", "second", "stock-opening"]);
});

test("Search matches supplied category and translated type, without inventing money or bank facts", () => {
  const vendor = finance({ id: "vendor", type: "vendor_payment", requestedBy: "CV Batu Prima" });
  const rows = [finance(), vendor, stock];
  expect(filterDesktopApprovals(rows, { ...defaults, query: "pembayaran vendor" })).toEqual([
    vendor,
  ]);
  expect(filterDesktopApprovals(rows, { ...defaults, query: "operasional" })).toHaveLength(2);
  expect(filterDesktopApprovals(rows, { ...defaults, query: "saldo awal stok" })).toEqual([stock]);
  expect(filterDesktopApprovals(rows, { ...defaults, query: "275000.25" })).toEqual([]);
  expect(filterDesktopApprovals(rows, { ...defaults, query: "rekening bank" })).toEqual([]);
  expect(approvalTypeLabel(vendor)).toBe("Pembayaran vendor");
});

test("Queue dates use the Jakarta calendar boundary", () => {
  expect(approvalQueueDate(new Date("2026-12-31T17:00:00.000Z"))).toBe("1 Jan 2027");
});
