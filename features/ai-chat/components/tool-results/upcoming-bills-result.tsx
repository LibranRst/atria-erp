"use client";

import { MoneyValue, StatusBadge } from "@/components/ui";
import type { StatusBadgeTone } from "@/components/ui";
import { getUpcomingBillsOutputSchema, type UpcomingBill } from "@/lib/ai/tool-output";
import * as React from "react";

import { expensesHref } from "../../utils/deep-links";
import { ResultRow, ResultShell } from "./result-shell";
import type { ToolResultProps } from "./types";

/**
 * Tagihan vendor yang belum lunas dan mendekati jatuh tempo.
 *
 * Yang sudah lewat tempo selalu naik ke atas, karena itu satu-satunya bagian
 * daftar yang menuntut tindakan hari ini.
 */

const MAX_BILLS = 6;

const TIMING_TONE: Record<UpcomingBill["timing"], StatusBadgeTone> = {
  OVERDUE: "critical",
  DUE_TODAY: "warning",
  UPCOMING: "neutral",
};

function timingLabel(bill: UpcomingBill): string {
  if (bill.timing === "OVERDUE") return `Telat ${Math.abs(bill.dueInDays)} hari`;
  if (bill.timing === "DUE_TODAY") return "Jatuh tempo hari ini";
  return `${bill.dueInDays} hari lagi`;
}

const TIMING_RANK: Record<UpcomingBill["timing"], number> = {
  OVERDUE: 0,
  DUE_TODAY: 1,
  UPCOMING: 2,
};

export function UpcomingBillsResult({ output }: ToolResultProps): React.JSX.Element | null {
  const parsed = getUpcomingBillsOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;
  if (data.bills.length === 0) return null;

  const sorted = [...data.bills].sort((left, right) => {
    const rank = TIMING_RANK[left.timing] - TIMING_RANK[right.timing];
    return rank !== 0 ? rank : left.dueInDays - right.dueInDays;
  });
  const shown = sorted.slice(0, MAX_BILLS);
  const hidden = sorted.length - shown.length;
  const overdueCount = sorted.filter((bill) => bill.timing === "OVERDUE").length;

  return (
    <ResultShell
      eyebrow={`Jatuh tempo ${data.horizonDays} hari`}
      title="Tagihan vendor"
      appliedFilters={data.appliedFilters}
      href={expensesHref()}
      linkLabel="Buka pengeluaran"
      trailing={
        <MoneyValue
          amount={data.totalOutstanding.amount}
          variant="compact"
          size="sm"
          align="right"
          tone={overdueCount > 0 ? "danger" : "muted"}
        />
      }
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {shown.map((bill) => (
          <ResultRow
            key={bill.billNumber}
            label={bill.vendorName}
            meta={`${bill.projectName} · ${timingLabel(bill)}`}
            value={
              <div className="flex flex-col items-end gap-1">
                <MoneyValue
                  amount={bill.amount.amount}
                  variant="compact"
                  size="sm"
                  align="right"
                />
                <StatusBadge tone={TIMING_TONE[bill.timing]} label={statusLabel(bill)} />
              </div>
            }
          />
        ))}
      </div>

      {hidden > 0 && (
        <p className="border-t border-black/5.5 px-4 py-2.5 text-meta font-semibold text-on-surface-variant">
          {hidden} tagihan lain tidak ditampilkan.
        </p>
      )}
    </ResultShell>
  );
}

function statusLabel(bill: UpcomingBill): string {
  if (bill.timing === "OVERDUE") return "Telat";
  if (bill.timing === "DUE_TODAY") return "Hari ini";
  return "Terjadwal";
}
