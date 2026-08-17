import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ApprovalsLoading from "@/app/approvals/loading";
import { ApprovalDecisionReasonFields } from "@/features/approvals/components/shared/approval-decision-reason-fields";
import { ApprovalDetailContent } from "@/features/approvals/components/views/approval-list";
import {
  APPROVAL_PAGE_SIZE,
  approvalIsCritical,
  groupApprovals,
  paginateApprovalGroups,
} from "@/features/approvals/utils/approval-list-utils";
import type {
  ApprovalDetail,
  FinanceApprovalDetail,
  InventoryOpeningApprovalDetail,
} from "@atria/core/finance/approval-types";

const approvalListPath = new URL("./approval-list.tsx", import.meta.url);

function approvalItem(overrides: Partial<FinanceApprovalDetail> = {}): ApprovalDetail {
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
    consumesBudgetActual: true,
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
    consumesBudgetActual: false,
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

    expect(groups.map((group) => group.label)).toEqual(["Hari ini", "Kemarin", "Lebih lama"]);
    expect(groups.map((group) => group.items.length)).toEqual([1, 1, 1]);
  });

  test("derives critical presentation from the post-approval budget", () => {
    expect(approvalIsCritical(approvalItem())).toBe(false);
    expect(approvalIsCritical(approvalItem({ amount: 5_000_000 }))).toBe(true);
    expect(approvalIsCritical(approvalItem({ priority: "CRITICAL" }))).toBe(true);
  });

  test("reports the exact next page size and partial group count", () => {
    const now = new Date("2026-07-27T12:00:00+07:00");
    const approvals = Array.from({ length: 23 }, (_, index) =>
      approvalItem({
        id: `approval-${index + 1}`,
        createdAt: new Date("2026-07-20T08:00:00+07:00"),
      }),
    );

    const page = paginateApprovalGroups(approvals, APPROVAL_PAGE_SIZE, now);

    expect(page.visibleCount).toBe(20);
    expect(page.remainingCount).toBe(3);
    expect(page.nextPageCount).toBe(3);
    expect(page.groups).toHaveLength(1);
    expect(page.groups[0]?.items).toHaveLength(20);
    expect(page.groups[0]?.totalCount).toBe(23);
  });

  test("always shows every approval from today before paginating older groups", () => {
    const now = new Date("2026-07-27T12:00:00+07:00");
    const today = Array.from({ length: 25 }, (_, index) =>
      approvalItem({
        id: `today-${index + 1}`,
        createdAt: new Date("2026-07-27T08:00:00+07:00"),
      }),
    );
    const older = Array.from({ length: 23 }, (_, index) =>
      approvalItem({
        id: `older-${index + 1}`,
        createdAt: new Date("2026-07-20T08:00:00+07:00"),
      }),
    );

    const page = paginateApprovalGroups([...today, ...older], APPROVAL_PAGE_SIZE, now);

    expect(page.visibleCount).toBe(45);
    expect(page.remainingCount).toBe(3);
    expect(page.nextPageCount).toBe(3);
    expect(page.groups.map((group) => group.label)).toEqual(["Hari ini", "Lebih lama"]);
    expect(page.groups[0]?.items).toHaveLength(25);
    expect(page.groups[0]?.totalCount).toBe(25);
    expect(page.groups[1]?.items).toHaveLength(20);
    expect(page.groups[1]?.totalCount).toBe(23);
  });

  test("caps the next page at twenty and hides it at the end", () => {
    const now = new Date("2026-07-27T12:00:00+07:00");
    const approvals = Array.from({ length: 45 }, (_, index) =>
      approvalItem({
        id: `approval-${index + 1}`,
        createdAt: new Date("2026-07-20T08:00:00+07:00"),
      }),
    );

    expect(paginateApprovalGroups(approvals, 20, now).nextPageCount).toBe(20);
    expect(paginateApprovalGroups(approvals, 40, now).nextPageCount).toBe(5);
    expect(paginateApprovalGroups(approvals, 45, now).nextPageCount).toBe(0);
    expect(paginateApprovalGroups(approvals, 45, now).remainingCount).toBe(0);
  });

  test("handles empty and exact page boundaries without a phantom next page", () => {
    const now = new Date("2026-07-27T12:00:00+07:00");
    const approvals = Array.from({ length: 21 }, (_, index) =>
      approvalItem({
        id: `approval-${index + 1}`,
        createdAt: new Date("2026-07-20T08:00:00+07:00"),
      }),
    );

    expect(paginateApprovalGroups([], APPROVAL_PAGE_SIZE, now)).toMatchObject({
      visibleCount: 0,
      remainingCount: 0,
      nextPageCount: 0,
    });
    expect(
      paginateApprovalGroups(approvals.slice(0, APPROVAL_PAGE_SIZE), APPROVAL_PAGE_SIZE, now),
    ).toMatchObject({
      visibleCount: 20,
      remainingCount: 0,
      nextPageCount: 0,
    });
    expect(paginateApprovalGroups(approvals, APPROVAL_PAGE_SIZE, now)).toMatchObject({
      visibleCount: 20,
      remainingCount: 1,
      nextPageCount: 1,
    });
  });

  test("keeps type counts in filters and shows actionable summary facts", async () => {
    const source = await Bun.file(approvalListPath).text();

    expect(source).toContain("Prioritas kritis");
    expect(source).toContain("Menunggu ≥3 hari");
    expect(source).not.toContain("Lapangan · Vendor · Stok");
    expect(source).toContain('label: "Lapangan"');
    expect(source).toContain('label: "Vendor"');
    expect(source).toContain('label: "Stok"');
    expect(source).toContain("Tampilkan {queuePage.nextPageCount} berikutnya");
    expect(source).not.toContain("Tampilkan 20 berikutnya");
    expect(source).toContain("count={group.totalCount}");
    expect(source).not.toContain("title={`${group.label} ·");
  });

  test("uses a route-specific skeleton matching summary, filters, and grouped rows", () => {
    const html = renderToStaticMarkup(<ApprovalsLoading />);

    expect(html).toContain("Memuat persetujuan");
    expect(html).toContain("Antrean persetujuan sedang disiapkan");
    expect(html).toContain("rounded-owner");
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
    expect(html).toContain("Dokumen pendukung");
    expect(html).toContain('alt="Bukti pengajuan"');
    expect(html).not.toContain("Tidak ada bukti terlampir");
    expect(html).not.toContain("progressbar");
    // Impact verdict leads its card, before the budget-category figure.
    expect(html.indexOf("Tetap dalam batas budget")).toBeLessThan(html.indexOf("Budget kategori"));
  });

  test("does not project a budget impact for an inventory purchase", () => {
    // Tagihan vendor kategori Material menjadi INVENTORY_ASSET dan tidak
    // dihitung sebagai realisasi kategori. Panel dampak pernah memproyeksikan
    // kenaikan yang tidak pernah terjadi: pembayaran Rp5.000.000 atas alokasi
    // Rp5.814.000 ditampilkan "86% terpakai", padahal setelah dibayar
    // `actual_amount` tetap 0 dan `used_percentage` tetap 0.
    const html = renderToStaticMarkup(
      <ApprovalDetailContent
        item={approvalItem({
          type: "vendor_payment",
          consumesBudgetActual: false,
          allocatedAmount: 5_814_000,
          actualSpent: 0,
          amount: 5_000_000,
        })}
        onOpenReceipt={() => undefined}
      />,
    );

    expect(html).toContain("Menjadi nilai persediaan, bukan realisasi");
    expect(html).not.toContain("86%");
    expect(html).not.toContain("sebelum batas");
  });

  test("still projects a budget impact for a cost that does consume actual", () => {
    const html = renderToStaticMarkup(
      <ApprovalDetailContent
        item={approvalItem({
          consumesBudgetActual: true,
          allocatedAmount: 5_814_000,
          actualSpent: 0,
          amount: 5_000_000,
        })}
        onOpenReceipt={() => undefined}
      />,
    );

    expect(html).toContain("86%");
    expect(html).not.toContain("Menjadi nilai persediaan, bukan realisasi");
  });

  test("shows an honest empty state when no receipt is attached", () => {
    const html = renderToStaticMarkup(
      <ApprovalDetailContent
        item={approvalItem({ receiptImageUrl: null })}
        onOpenReceipt={() => undefined}
      />,
    );

    expect(html).toContain("Tidak ada bukti terlampir");
    expect(html).not.toContain('alt="Bukti pengajuan"');
  });

  test("shows quantity and unit cost for every opening inventory item", () => {
    const openingApproval = openingApprovalItem();

    const html = renderToStaticMarkup(
      <ApprovalDetailContent item={openingApproval} onOpenReceipt={() => undefined} />,
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
