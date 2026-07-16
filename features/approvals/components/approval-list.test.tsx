import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ApprovalsLoading from "@/app/approvals/loading";
import { ApprovalDetailContent } from "@/features/approvals/components/approval-list";
import {
  approvalIsCritical,
  groupApprovals,
} from "@/features/approvals/components/approval-list-utils";
import type { ApprovalDetail } from "@/lib/finance/approval-types";

function approvalItem(
  overrides: Partial<ApprovalDetail> = {},
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

describe("Approval decision queue presentation", () => {
  test("groups the ranked queue by decision age", () => {
    const now = new Date("2026-07-15T12:00:00+07:00");
    const groups = groupApprovals([
      approvalItem(),
      approvalItem({ id: "approval-2", createdAt: new Date("2026-07-14T10:00:00+07:00") }),
      approvalItem({ id: "approval-3", createdAt: new Date("2026-07-12T10:00:00+07:00") }),
    ], now);

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
    expect(approvalIsCritical(approvalItem({ priority: "CRITICAL" }))).toBe(true);
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
});
