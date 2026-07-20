import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ApprovalsLoading from "@/app/approvals/loading";
import { ApprovalDecisionReasonFields } from "@/features/approvals/components/approval-decision-reason-fields";
import { ApprovalDetailContent } from "@/features/approvals/components/approval-list";
import {
  approvalIsCritical,
  groupApprovals,
} from "@/features/approvals/components/approval-list-utils";
import type {
  ApprovalDetail,
  FinanceApprovalDetail,
  InventoryOpeningApprovalDetail,
} from "@/lib/finance/approval-types";

function approvalItem(
  overrides: Partial<FinanceApprovalDetail> = {},
): ApprovalDetail {
  return {
    id: "approval-1",
    createdAt: new Date("2026-07-15T08:00:00+07:00"),
    dueDate: null,
    notes: null,
    type: "project_cost",
    referenceId: "cost-1",
    amount: 2_000_000,
    description: "Pembelian material lapangan",
    receiptImageUrl: null,
    projectName: "Menteng Villa",
    budgetItemName: "Material",
    allocatedAmount: 10_000_000,
    actualSpent: 5_000_000,
    requestedBy: "PM Budi",
    budgetOverrun: false,
    priority: "NORMAL",
    priorityReason: "Perlu keputusan Owner",
    ...overrides,
  };
}

function openingApprovalItem(
  overrides: Partial<InventoryOpeningApprovalDetail> = {},
): InventoryOpeningApprovalDetail {
  return {
    id: "inventory-opening-batch-1",
    createdAt: new Date("2026-07-18T08:00:00+07:00"),
    dueDate: null,
    notes: "Stock opname cutover",
    type: "inventory_opening",
    referenceId: "batch-1",
    amount: 1_000_000,
    description: "Saldo awal stok OPEN-001",
    receiptImageUrl: null,
    projectName: "Inventory perusahaan",
    budgetItemName: "1 item stok",
    allocatedAmount: 0,
    actualSpent: 0,
    requestedBy: "Sari Purchasing",
    budgetOverrun: false,
    priority: "NORMAL",
    priorityReason: "Perlu persetujuan saldo stok",
    inventoryItems: [
      {
        id: "opening-item-1",
        materialInventoryId: "inventory-1",
        materialName: "Multiplek 18 mm",
        locationName: "Gudang Utama",
        unit: "lembar",
        quantity: 12.5,
        unitCost: 80_000,
        totalValue: 1_000_000,
      },
    ],
    ...overrides,
  };
}

describe("Approval decision queue presentation", () => {
  test("groups the ranked queue by decision age", () => {
    const now = new Date("2026-07-15T12:00:00+07:00");
    const groups = groupApprovals(
      [
        approvalItem(),
        approvalItem({
          id: "approval-2",
          createdAt: new Date("2026-07-14T10:00:00+07:00"),
        }),
        approvalItem({
          id: "approval-3",
          createdAt: new Date("2026-07-12T10:00:00+07:00"),
        }),
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Hari ini",
      "Kemarin",
      "Lebih lama",
    ]);
    expect(groups.map((group) => group.items.length)).toEqual([1, 1, 1]);
  });

  test("derives critical presentation from the post-approval budget", () => {
    expect(approvalIsCritical(approvalItem())).toBe(false);
    expect(approvalIsCritical(approvalItem({ amount: 5_000_000 }))).toBe(true);
    expect(approvalIsCritical(approvalItem({ priority: "CRITICAL" }))).toBe(
      true,
    );
  });

  test("uses a route-specific skeleton matching summary, filters, and grouped rows", () => {
    const html = renderToStaticMarkup(<ApprovalsLoading />);

    expect(html).toContain("Memuat persetujuan");
    expect(html).toContain("Antrean persetujuan sedang disiapkan");
    expect(html).toContain("rounded-[26px]");
    expect(html).not.toContain("spinner");
  });

  test("presents the drawer detail as a decision review", () => {
    const html = renderToStaticMarkup(
      <ApprovalDetailContent
        item={approvalItem({
          dueDate: new Date("2026-07-17T12:00:00+07:00"),
          notes: "Pastikan material tiba sebelum pemasangan.",
          receiptImageUrl: "/receipt.jpg",
        })}
        onOpenReceipt={() => undefined}
      />,
    );

    expect(html).toContain("Nilai pengajuan");
    expect(html).toContain("Konteks pengajuan");
    expect(html).toContain("Dampak ke budget");
    expect(html).toContain("Saat ini");
    expect(html).toContain("Jika disetujui");
    expect(html).toContain("Lihat bukti pengajuan");
    expect(html).not.toContain("progressbar");
  });

  test("shows quantity and unit cost for every opening inventory item", () => {
    const openingApproval = openingApprovalItem();

    const html = renderToStaticMarkup(
      <ApprovalDetailContent
        item={openingApproval}
        onOpenReceipt={() => undefined}
      />,
    );

    expect(html).toContain("Item stok fisik");
    expect(html).toContain("Multiplek 18 mm");
    expect(html).toContain("Gudang Utama");
    expect(html).toContain("12,5 lembar");
    expect(html).toContain("Harga per unit");
    expect(html).toContain("Rp 80.000");
    expect(html).toContain("Subtotal item");
  });

  test("requires a visible approval reason for opening inventory", () => {
    const html = renderToStaticMarkup(
      <ApprovalDecisionReasonFields
        item={openingApprovalItem()}
        canEmergencyOverride={false}
        approvalReason=""
        emergencyOverride={false}
        emergencyReason=""
        pending={false}
        idPrefix="test-approval"
        onApprovalReasonChange={() => undefined}
        onEmergencyOverrideChange={() => undefined}
        onEmergencyReasonChange={() => undefined}
      />,
    );

    expect(html).toContain("Alasan persetujuan");
    expect(html).toContain("Wajib diisi minimal 10 karakter");
    expect(html).toContain("test-approval-approval-reason");
  });

  test("never exposes emergency override for opening-inventory self-approval", () => {
    const html = renderToStaticMarkup(
      <ApprovalDecisionReasonFields
        item={openingApprovalItem({ canEmergencyOverride: true })}
        canEmergencyOverride
        approvalReason=""
        emergencyOverride={false}
        emergencyReason=""
        pending={false}
        idPrefix="test-emergency"
        onApprovalReasonChange={() => undefined}
        onEmergencyOverrideChange={() => undefined}
        onEmergencyReasonChange={() => undefined}
      />,
    );

    expect(html).not.toContain("Gunakan emergency override");
    expect(html).toContain("Alasan persetujuan");
  });
});
