import type { PermissionKey } from "@atria/core/auth/permissions";
import type {
  ApprovalDetail,
  FinanceApprovalDetail,
  InventoryOpeningApprovalDetail,
} from "@atria/core/finance/approval-types";

export type ApprovalsFixtureScenario =
  | "complete"
  | "empty"
  | "read-only"
  | "stock-only"
  | "self-override"
  | "pending"
  | "source-error"
  | "restricted";

export const APPROVALS_FIXTURE_CHANGE_ORDERS = [
  {
    id: "change-order-preview-1",
    projectId: "adf10000-0000-4000-8000-000000004000",
    projectName: "Menteng Villa · Kitchen & Living",
    valueDelta: "12500000.25",
    reason: "Penambahan kabinet dan perubahan finishing. Data sintetis.",
    createdByName: "Budi Santoso",
    createdAt: "2026-10-14T03:00:00.000Z",
    baseRevision: 2,
    revisedRevision: 3,
  },
];

export const APPROVALS_FIXTURE_REFERENCE = "2026-10-15T05:00:00.000Z";
export const approvalsFixtureId = (index: number): string =>
  `adf10000-0000-4000-8000-${String(index).padStart(12, "0")}`;

export const APPROVALS_FIXTURE_PERMISSIONS: readonly PermissionKey[] = [
  "view:approval_queue",
  "decide:all_approvals",
  "approve:cost",
  "approve:opening_inventory",
  "approve:rab",
  "override:self_approval",
];
export const APPROVALS_FIXTURE_READ_PERMISSIONS: readonly PermissionKey[] = [
  "view:approval_queue",
  "decide:all_approvals",
];
export const APPROVALS_FIXTURE_STOCK_PERMISSIONS: readonly PermissionKey[] = [
  "view:approval_queue",
  "approve:opening_inventory",
];

const projects = [
  "Menteng Villa · Kitchen & Living",
  "Cipete House · Interior",
  "BSD Office · Lantai 2",
];
const descriptions = [
  "Multipleks 18 mm untuk kabinet kitchen",
  "Termin fabrikasi solid surface countertop",
  "Pencatatan stok awal workshop",
  "Upah instalasi kabinet dan finishing",
  "Pelunasan engsel soft-close dan rel laci",
  "Pencatatan stok awal gudang proyek",
];

function financeApproval(index: number): FinanceApprovalDetail {
  const vendor = index % 3 === 1;
  const overrun = index === 0 || index === 18;
  const waiting = index % 4 === 0;
  const amount = (index + 1) * 275_000 + (index % 5 === 0 ? 0.25 : 0);
  const inventoryPurchase = vendor && index % 2 === 1;
  return {
    id: approvalsFixtureId(index + 1),
    referenceId: approvalsFixtureId(1000 + index),
    type: vendor ? "vendor_payment" : "project_cost",
    createdAt: new Date(Date.UTC(2026, 9, waiting ? 10 : 15 - (index % 3), 2)),
    dueDate: vendor ? new Date(Date.UTC(2026, 9, 14 + (index % 12), 3)) : null,
    notes: vendor
      ? inventoryPurchase
        ? "Data sintetis. Cocokkan jadwal pencairan dengan tagihan dan penerimaan barang."
        : "Data sintetis. Termin fabrikasi dan instalasi sesuai lingkup subcon yang disepakati."
      : "Data sintetis. Nota pembelian dan rincian biaya telah dilampirkan untuk ditinjau.",
    amount,
    description: `${vendor && !inventoryPurchase ? "Termin fabrikasi dan instalasi kabinet subcon" : descriptions[index % descriptions.length]} · tahap ${Math.floor(index / 6) + 1}`,
    receiptImageUrl: index % 6 === 0 ? "/receipt_test.png" : null,
    projectName: projects[index % projects.length]!,
    budgetItemName: vendor
      ? inventoryPurchase
        ? "Material"
        : "Subcon"
      : index % 6 === 0
        ? "Material"
        : "Tukang",
    allocatedAmount: overrun ? 5_000_000 : 90_000_000,
    actualSpent: overrun ? 4_950_000.25 : 31_500_000.25,
    requestedBy: vendor ? "CV Batu Prima Countertop" : "Budi Santoso",
    consumesBudgetActual: !inventoryPurchase,
    budgetOverrun: overrun,
    priority: overrun ? "CRITICAL" : waiting ? "WARNING" : "NORMAL",
    priorityReason: overrun
      ? "Melewati batas budget"
      : waiting
        ? "Menunggu 5 hari"
        : "Perlu keputusan Owner",
  };
}

function openingApproval(index: number): InventoryOpeningApprovalDetail {
  const quantity = index % 2 === 0 ? 12.5 : 8;
  const unitCost = 80_000.02;
  return {
    id: approvalsFixtureId(index + 1),
    referenceId: approvalsFixtureId(1000 + index),
    type: "inventory_opening",
    createdAt: new Date(Date.UTC(2026, 9, index % 4 === 0 ? 10 : 15, 2)),
    dueDate: null,
    notes: "Data sintetis. Hasil stock opname workshop sebelum mulai pencatatan stok.",
    amount: Number((quantity * unitCost).toFixed(2)),
    description: `Stok awal workshop · dokumen ${Math.floor(index / 3) + 1}`,
    receiptImageUrl: null,
    projectName: "Inventory perusahaan",
    budgetItemName: "1 item stok",
    allocatedAmount: 0,
    actualSpent: 0,
    requestedBy: "Sari Purchasing",
    consumesBudgetActual: false,
    budgetOverrun: false,
    priority: index % 4 === 0 ? "WARNING" : "NORMAL",
    priorityReason: index % 4 === 0 ? "Menunggu 5 hari" : "Perlu persetujuan saldo stok",
    inventoryItems: [
      {
        id: approvalsFixtureId(2000 + index),
        materialInventoryId: approvalsFixtureId(3000 + index),
        materialName: index % 2 === 0 ? "Multipleks 18 mm" : "Engsel soft-close",
        locationName: index % 2 === 0 ? "Gudang Workshop" : "Gudang Proyek Cipete",
        unit: index % 2 === 0 ? "lembar" : "set",
        quantity,
        unitCost,
        totalValue: Number((quantity * unitCost).toFixed(2)),
      },
    ],
  };
}

export const APPROVALS_FIXTURE_ITEMS: readonly ApprovalDetail[] = Array.from(
  { length: 36 },
  (_, index): ApprovalDetail => (index % 3 === 2 ? openingApproval(index) : financeApproval(index)),
).sort((left, right): number => {
  // Synthetic source order only: production ranking remains owned by the API.
  const rank = (priority: ApprovalDetail["priority"]): number =>
    priority === "CRITICAL" ? 2 : priority === "WARNING" ? 1 : 0;
  return (
    Number(right.budgetOverrun) - Number(left.budgetOverrun) ||
    rank(right.priority) - rank(left.priority) ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    right.amount - left.amount
  );
});

export function approvalsFixturePermissions(
  scenario: ApprovalsFixtureScenario,
): readonly PermissionKey[] {
  if (scenario === "read-only") return APPROVALS_FIXTURE_READ_PERMISSIONS;
  if (scenario === "stock-only") return APPROVALS_FIXTURE_STOCK_PERMISSIONS;
  if (scenario === "restricted") return ["view:approval_queue"];
  return APPROVALS_FIXTURE_PERMISSIONS;
}

export function approvalsFixtureData(
  scenario: ApprovalsFixtureScenario,
): readonly ApprovalDetail[] {
  if (scenario === "empty" || scenario === "restricted" || scenario === "source-error") return [];
  if (scenario === "stock-only")
    return APPROVALS_FIXTURE_ITEMS.filter((item) => item.type === "inventory_opening");
  if (scenario === "self-override")
    return [{ ...financeApproval(0), canEmergencyOverride: true, requestedBy: "Karin Putri" }];
  return APPROVALS_FIXTURE_ITEMS;
}
