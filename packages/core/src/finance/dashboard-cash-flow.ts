import { z } from "zod";
import { DASHBOARD_TIME_ZONE } from "./dashboard-overview";
import { fromCents, parseNumericToCents } from "./money-minor";
import { normalizeCashDirection } from "./cash-direction";

export const dashboardCashFlowInputSchema = z.object({
  months: z.union([z.literal(6), z.literal(12)]).default(6),
});
export type DashboardCashFlowInput = z.input<typeof dashboardCashFlowInputSchema>;
export type CashFlowBucket = {
  readonly monthKey: string;
  readonly cashIn: number;
  readonly cashOut: number;
  readonly net: number;
  readonly isPartial: boolean;
};
export type CashFlowExclusion = { readonly count: number; readonly amount: number };
export type DashboardCashFlowTrend = {
  readonly generatedAt: Date;
  readonly months: 6 | 12;
  readonly buckets: readonly CashFlowBucket[];
  readonly transactionCount: number;
  readonly totalNet: number;
  readonly exclusions: Readonly<
    Record<"opening" | "transfer" | "adjustment" | "unclassified", CashFlowExclusion>
  >;
};
export type CashFlowAggregate = {
  readonly type: string;
  readonly category: string;
  readonly referenceType: string | null;
  readonly amount: string | null;
  readonly count: number;
};
export type CashFlowMonthRange = {
  readonly monthKey: string;
  readonly start: Date;
  readonly end: Date;
  readonly isPartial: boolean;
};
export function cashFlowMonthRanges(months: 6 | 12, now: Date): readonly CashFlowMonthRange[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value),
    month = Number(parts.find((p) => p.type === "month")?.value) - 1;
  return Array.from({ length: months }, (_, i) => {
    const normalized = new Date(Date.UTC(year, month - months + 1 + i, 1));
    const y = normalized.getUTCFullYear(),
      m = normalized.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1) - 7 * 60 * 60 * 1000),
      next = new Date(Date.UTC(y, m + 1, 1) - 7 * 60 * 60 * 1000);
    return {
      monthKey: `${y}-${String(m + 1).padStart(2, "0")}`,
      start,
      end: next > now ? now : next,
      isPartial: i === months - 1,
    };
  });
}
export function classifyCashFlow(
  row: Pick<CashFlowAggregate, "category" | "referenceType">,
): "included" | "opening" | "transfer" | "adjustment" | "unclassified" {
  const ref = row.referenceType,
    category = row.category;
  if (ref === "opening_balance" || category === "opening_balance") return "opening";
  if (
    ref === "bank_transfer" ||
    category === "bank_transfer_in" ||
    category === "bank_transfer_out"
  )
    return "transfer";
  if (category === "correction" || category === "cash_adjustment") return "adjustment";
  if (["client_payment", "vendor_payment", "project_cost"].includes(ref ?? "")) return "included";
  if (
    (ref === "manual_cash_movement" || ref === null) &&
    ["owner_capital", "bank_fee", "other"].includes(category)
  )
    return "included";
  if (ref === null && ["client_payment", "vendor_payment", "field_claim"].includes(category))
    return "included";
  return "unclassified";
}
export function buildCashFlowTrend(
  months: 6 | 12,
  now: Date,
  groups: readonly (readonly CashFlowAggregate[])[],
): DashboardCashFlowTrend {
  const exclusions = {
    opening: { count: 0, cents: 0n },
    transfer: { count: 0, cents: 0n },
    adjustment: { count: 0, cents: 0n },
    unclassified: { count: 0, cents: 0n },
  };
  let transactionCount = 0;
  let totalNet = 0n;
  const buckets = cashFlowMonthRanges(months, now).map((range, index): CashFlowBucket => {
    let incoming = 0n,
      outgoing = 0n;
    for (const row of groups[index] ?? []) {
      const cents = parseNumericToCents(row.amount ?? "0");
      let kind = classifyCashFlow(row);
      let direction: "INFLOW" | "OUTFLOW" | null = null;
      try {
        direction = normalizeCashDirection(row.type);
      } catch {
        kind = "unclassified";
      }
      if (kind !== "included" || cents < 0n) {
        const entry =
          exclusions[cents < 0n ? "unclassified" : kind === "included" ? "unclassified" : kind];
        entry.count += row.count;
        entry.cents += cents < 0n ? -cents : cents;
        continue;
      }
      transactionCount += row.count;
      if (direction === "INFLOW") incoming += cents;
      else outgoing += cents;
    }
    totalNet += incoming - outgoing;
    return {
      monthKey: range.monthKey,
      cashIn: Number(fromCents(incoming)),
      cashOut: Number(fromCents(outgoing)),
      net: Number(fromCents(incoming - outgoing)),
      isPartial: range.isPartial,
    };
  });
  const exposure = (entry: { count: number; cents: bigint }): CashFlowExclusion => ({
    count: entry.count,
    amount: Number(fromCents(entry.cents)),
  });
  return {
    months,
    generatedAt: now,
    buckets,
    transactionCount,
    totalNet: Number(fromCents(totalNet)),
    exclusions: {
      opening: exposure(exclusions.opening),
      transfer: exposure(exclusions.transfer),
      adjustment: exposure(exclusions.adjustment),
      unclassified: exposure(exclusions.unclassified),
    },
  };
}
