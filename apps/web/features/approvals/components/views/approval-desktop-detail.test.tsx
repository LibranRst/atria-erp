import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  FinanceApprovalDetail,
  InventoryOpeningApprovalDetail,
} from "@atria/core/finance/approval-types";
import { ApprovalDesktopDetail } from "./approval-desktop-detail";

const financeItem: FinanceApprovalDetail = {
  id: "approval-finance",
  type: "project_cost",
  referenceId: "private-cost-id",
  createdAt: new Date("2026-10-15T03:00:00Z"),
  dueDate: null,
  notes: "[Kategori: Operasional] Transportasi lapangan",
  amount: 1_000_000.25,
  description: "Transportasi proyek",
  receiptImageUrl: null,
  projectName: "Menteng Villa",
  budgetItemName: "Operasional",
  allocatedAmount: 10_000_000.5,
  actualSpent: 5_000_000.1,
  requestedBy: "Budi",
  consumesBudgetActual: true,
  budgetOverrun: false,
  priority: "NORMAL",
  priorityReason: "Perlu keputusan Owner",
};

const openingItem: InventoryOpeningApprovalDetail = {
  ...financeItem,
  id: "approval-opening",
  type: "inventory_opening",
  referenceId: "opening-1",
  amount: 1_000_000.75,
  description: "Saldo awal stok gudang",
  projectName: "Inventory perusahaan",
  budgetItemName: "1 item stok",
  allocatedAmount: 0,
  actualSpent: 0,
  budgetOverrun: false,
  consumesBudgetActual: false,
  inventoryItems: [
    {
      id: "opening-item-1",
      materialInventoryId: "inventory-private-id",
      materialName: "Multiplek 18 mm",
      locationName: "Gudang Utama",
      unit: "lembar",
      quantity: 1.5,
      unitCost: 666_667.17,
      totalValue: 1_000_000.75,
    },
  ],
};

function renderDetail(
  item: FinanceApprovalDetail | InventoryOpeningApprovalDetail = financeItem,
  canDecide: boolean = true,
  pending: boolean = false,
): string {
  return renderToStaticMarkup(
    <ApprovalDesktopDetail
      item={item}
      pending={pending}
      canDecide={canDecide}
      onBack={() => undefined}
      onOpenReceipt={() => undefined}
      onDecision={() => undefined}
    />,
  );
}

function decisionButtons(markup: string): readonly string[] {
  return [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map((match) => match[0])
    .filter((button) => button.includes("Setujui") || button.includes("Tolak"));
}

describe("desktop approval detail", () => {
  test("retains cents in the request, allocation and before/after projection", () => {
    const markup = renderDetail();
    expect(markup).toContain("1.000.000,25");
    expect(markup).toContain("10.000.000,50");
    expect(markup).toContain("5.000.000,10");
    expect(markup).toContain("6.000.000,35");
    expect(markup).toContain("Persetujuan tidak langsung mencairkan pembayaran.");
    expect(markup).toContain("Transportasi lapangan");
    expect(markup).not.toContain("[Kategori:");
    expect(markup).not.toContain("private-cost-id");
  });

  test("inventory purchase approval keeps the category actual unchanged", () => {
    const markup = renderDetail({
      ...financeItem,
      type: "vendor_payment",
      consumesBudgetActual: false,
    });
    expect(markup).toContain("Menjadi nilai persediaan, bukan realisasi");
    expect(markup.match(/5\.000\.000,10/g)).toHaveLength(4);
    expect(markup).not.toContain("6.000.000,35");
    expect(markup).not.toContain("terpakai</p>");
  });

  test("missing allocation is not presented as a healthy budget", () => {
    const markup = renderDetail({ ...financeItem, allocatedAmount: 0 });
    expect(markup).toContain("Belum ada alokasi budget");
    expect(markup).not.toContain("Tetap dalam batas budget");
  });

  test("readonly and pending decisions stay disabled", () => {
    for (const [canDecide, pending] of [
      [false, false],
      [true, true],
    ] as const) {
      const markup = renderDetail(financeItem, canDecide, pending);
      const buttons = decisionButtons(markup);
      expect(buttons).toHaveLength(2);
      expect(buttons.every((button) => button.includes('disabled=""'))).toBe(true);
    }
    expect(renderDetail(financeItem, false)).toContain("hanya untuk meninjau");
    expect(decisionButtons(renderDetail()).some((button) => button.includes('disabled=""'))).toBe(
      false,
    );
  });

  test("receipt control appears only when a source receipt is provided", () => {
    expect(renderDetail()).toContain("Tidak ada bukti terlampir.");
    expect(renderDetail()).not.toContain("Buka bukti pengajuan");
    const markup = renderDetail({ ...financeItem, receiptImageUrl: "/receipt-proof.png" });
    expect(markup).toContain("Buka bukti pengajuan");
    expect(markup).not.toContain("Tidak ada bukti terlampir.");
  });

  test("stock opening keeps exact item values and explains the separate stock effect", () => {
    const markup = renderDetail(openingItem);
    expect(markup).toContain("Multiplek 18 mm");
    expect(markup).toContain("Gudang Utama");
    expect(markup).toContain("666.667,17");
    expect(markup).toContain("1.000.000,75");
    expect(markup).toContain(
      "Tidak membuat kas keluar, utang vendor, atau realisasi biaya proyek.",
    );
    expect(markup).not.toContain("Proyeksi sesudah");
    expect(markup).not.toContain("inventory-private-id");
  });
});
