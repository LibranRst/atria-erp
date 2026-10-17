import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { MaterialDesktopActivityDetail } from "./material-desktop-activity-detail";
import {
  materialActivityDate,
  materialActivityDateCopy,
  materialMovementDirectionCopy,
  MaterialActivityStatus,
  type MaterialActivitySelection,
} from "./material-desktop-activity-rows";

const capabilities: MaterialOperationsDashboard["capabilities"] = {
  canReceive: false,
  canOperate: false,
  canTransfer: false,
  canCount: false,
  canApproveCount: false,
  canRequestReversal: false,
  canApproveReversal: false,
  canEmergencyAdjust: false,
};
const receipt: MaterialActivitySelection = {
  kind: "receipts",
  item: {
    id: "receipt-test",
    receiptNumber: "Penerimaan Menteng",
    status: "REVERSAL_REQUESTED",
    projectId: "project-test",
    projectName: "Menteng Villa",
    locationId: "location-test",
    locationName: "Lokasi proyek",
    vendorBillNumber: "Tagihan pemasok",
    receivedAt: new Date("2026-12-31T18:05:00Z"),
    receivedByName: "Rani",
    reversalReason: "Dokumen pemasok tercatat dua kali.",
    total: 1_000_000.25,
    items: [
      { materialName: "Cat dinding", quantity: 2.5, unitCost: 200_000.1, unit: "liter" },
      { materialName: "Panel kayu", quantity: 2, unitCost: 250_000, unit: "lembar" },
    ],
  },
};
function markup(
  row: MaterialActivitySelection,
  permissions: MaterialOperationsDashboard["capabilities"] = capabilities,
  pending = false,
): string {
  return renderToStaticMarkup(
    <MaterialDesktopActivityDetail
      selection={row}
      capabilities={permissions}
      pending={pending}
      onBack={() => undefined}
      onOpenReceipt={() => undefined}
      onDecision={() => undefined}
      onLoadCountDraft={() => undefined}
    />,
  );
}
describe("desktop material activity detail", () => {
  test("table compacts a reversal badge while retaining the full accessible status and detail label", () => {
    const compact = renderToStaticMarkup(
      <MaterialActivityStatus status="REVERSAL_REQUESTED" compact />,
    );
    expect(compact).toContain('aria-label="Pembatalan diminta"');
    expect(compact).toContain('title="Pembatalan diminta"');
    expect(compact).toContain("Pembatalan</span>");
    expect(renderToStaticMarkup(<MaterialActivityStatus status="REVERSAL_REQUESTED" />)).toContain(
      "Pembatalan diminta</span>",
    );
  });
  test("physical direction keeps reservations distinct from actual stock changes", () => {
    expect(materialMovementDirectionCopy("NEUTRAL")).toBe("Tanpa perpindahan fisik");
    expect(materialMovementDirectionCopy("IN")).toBe("Stok masuk");
    expect(materialMovementDirectionCopy("OUT")).toBe("Stok keluar");
    expect(materialMovementDirectionCopy("legacy-unknown")).toBe("Arah belum tersedia");
  });
  test("keeps exact valuation and each item's actual unit without a mixed-unit total", () => {
    const html = markup(receipt);
    expect(html).toContain("1.000.000,25");
    expect(html).toContain("2,5 liter");
    expect(html).toContain("2 lembar");
    expect(html).not.toContain("4,5");
    expect(html).toContain("Pembayaran vendor dikelola terpisah");
  });
  test("reversal decisions are absent without the corresponding permission", () => {
    const html = markup(receipt);
    expect(html).not.toContain("Tinjau pembatalan");
    expect(html).not.toContain("Tolak pembatalan");
    expect(html).toContain("Buka rincian penerimaan");
    const allowed = markup(receipt, { ...capabilities, canApproveReversal: true });
    expect(allowed).toContain("Tinjau pembatalan");
    expect(allowed).toContain("Tolak pembatalan");
  });
  test("retains business-date meaning at a Jakarta year boundary", () => {
    expect(materialActivityDate(receipt)).toEqual(receipt.item.receivedAt);
    const date = materialActivityDateCopy(materialActivityDate(receipt));
    expect(date).toContain("2027");
    expect(date).toContain("Jan");
    expect(date).not.toContain("2026");
  });
  test("a count draft requires its server supplied editability as well as permission", () => {
    const count: MaterialActivitySelection = {
      kind: "counts",
      item: {
        id: "count-test",
        countNumber: "Opname gudang",
        status: "DRAFT",
        canEdit: false,
        locationId: "location-test",
        locationName: "Gudang",
        countedAt: new Date(),
        createdByName: "Rani",
        note: null,
        items: [],
      },
    };
    expect(markup(count, { ...capabilities, canCount: true })).not.toContain("Lanjutkan draft");
    const editable: MaterialActivitySelection = {
      ...count,
      item: { ...count.item, canEdit: true },
    };
    expect(markup(editable)).not.toContain("Lanjutkan draft");
    expect(markup(editable, { ...capabilities, canCount: true })).toContain("Lanjutkan draft");
  });
});
