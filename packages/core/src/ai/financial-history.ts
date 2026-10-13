import { z } from "zod";
import { classifyCashFlow, type CashFlowAggregate } from "../finance/dashboard-cash-flow";
import { normalizeCashDirection } from "../finance/cash-direction";
import { fromCents, parseNumericToCents } from "../finance/money-minor";

export const FINANCIAL_HISTORY_TIME_ZONE = "Asia/Jakarta";
const dayMs = 86_400_000;
const offsetMs = 7 * 3_600_000;
const decimal = z.string().regex(/^-?\d+\.\d{2}$/);
const countSchema = z.number().int().nonnegative();
export const financialHistoryPeriodSchema = z.object({
  label: z.string(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  requestedEnd: z.iso.datetime(),
  isPartial: z.boolean(),
});
export type FinancialHistoryPeriod = z.infer<typeof financialHistoryPeriodSchema>;
export type FinancialHistoryDomain = "expenses" | "cash";
export type FinancialHistoryRequest = {
  readonly domains: readonly FinancialHistoryDomain[];
  readonly periods: readonly FinancialHistoryPeriod[];
  readonly comparison: boolean;
  readonly error: string | null;
};
const exclusionSchema = z.object({ count: countSchema, amount: decimal });
export const historicalCashTotalsSchema = z.object({
  transactionCount: countSchema,
  cashIn: decimal,
  cashOut: decimal,
  net: decimal,
  exclusions: z.object({
    opening: exclusionSchema,
    transfer: exclusionSchema,
    adjustment: exclusionSchema,
    unclassified: exclusionSchema,
  }),
});
export const historicalExpenseTotalsSchema = z.object({
  recordedExpenseAmount: decimal,
  recordedCount: countSchema,
  pendingAmount: decimal,
  pendingCount: countSchema,
  excludedAmount: decimal,
  excludedCount: countSchema,
  groups: z.array(
    z.object({
      categoryId: z.string(),
      categoryName: z.string(),
      status: z.string(),
      sourceType: z.string(),
      amount: decimal,
      count: countSchema,
    }),
  ),
});
export const financialHistoryOutputSchema = z.object({
  kind: z.literal("financial-history"),
  asOf: z.iso.datetime(),
  timeZone: z.literal(FINANCIAL_HISTORY_TIME_ZONE),
  scope: z.object({
    kind: z.enum(["company", "assigned", "project", "account"]),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    accountId: z.string().optional(),
    accountName: z.string().optional(),
    label: z.string(),
  }),
  periods: z
    .array(
      financialHistoryPeriodSchema.extend({
        expenses: historicalExpenseTotalsSchema.optional(),
        cash: historicalCashTotalsSchema.optional(),
      }),
    )
    .min(1)
    .max(2),
  issues: z.array(z.string()),
  comparison: z.boolean(),
});
export type FinancialHistoryOutput = z.infer<typeof financialHistoryOutputSchema>;
export type HistoricalExpenseAggregate = {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly status: string;
  readonly sourceType: string;
  readonly amount: string | null;
  readonly count: number;
};

function localParts(now: Date): { year: number; month: number; day: number } {
  const local = new Date(now.getTime() + offsetMs);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}
function dayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - offsetMs);
}
function validDate(year: number, month: number, day: number): Date | null {
  const d = dayStart(year, month, day);
  const actual = localParts(d);
  return actual.year === year && actual.month === month && actual.day === day ? d : null;
}
function period(start: Date, end: Date, now: Date, label: string): FinancialHistoryPeriod | null {
  if (start >= now || end <= start || end.getTime() - start.getTime() > 366 * dayMs) return null;
  return {
    label,
    start: start.toISOString(),
    end: new Date(Math.min(end.getTime(), now.getTime())).toISOString(),
    requestedEnd: end.toISOString(),
    isPartial: end > now,
  };
}
function dateLabel(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    timeZone: FINANCIAL_HISTORY_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
const monthNames: Readonly<Record<string, number>> = {
  jan: 0,
  januari: 0,
  january: 0,
  feb: 1,
  februari: 1,
  february: 1,
  mar: 2,
  maret: 2,
  march: 2,
  apr: 3,
  april: 3,
  mei: 4,
  may: 4,
  jun: 5,
  juni: 5,
  june: 5,
  jul: 6,
  juli: 6,
  july: 6,
  agu: 7,
  ags: 7,
  agustus: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oct: 9,
  oktober: 9,
  october: 9,
  nov: 10,
  november: 10,
  des: 11,
  dec: 11,
  desember: 11,
  december: 11,
};
const monthPattern = Object.keys(monthNames).join("|");
export function financialHistoryDomains(question: string): readonly FinancialHistoryDomain[] {
  const q = question.toLocaleLowerCase("id-ID");
  const domains: FinancialHistoryDomain[] = [];
  if (/\b(pengeluaran|expense|expenses|biaya tercatat|belanja)\b/.test(q)) domains.push("expenses");
  if (/\b(arus kas|cash\s*flow|kas masuk|kas keluar|dana masuk|dana keluar)\b/.test(q))
    domains.push("cash");
  return domains;
}
/** Remove quoted entity labels for intent checks only; do not use this text for entity bindings. */
export function stripQuotedEntitiesForIntent(question: string): string {
  return question.replace(/"[^"\n]*"|“[^”\n]*”|'[^'\n]*'/g, "");
}
export function isFinancialHistoryQuestion(question: string): boolean {
  const q = question.toLocaleLowerCase("id-ID");
  const intent = stripQuotedEntitiesForIntent(q).replace(
    /\b(?:jangan|tanpa)\s+(?:simpan|ubah|bayar|konfirmasi|mutasi|mengubah|menyimpan|gunakan|menggunakan)(?:\s+data)?\b/g,
    "",
  );
  if (
    /\b(?:buat|siapkan|ubah|ganti|koreksi|simpan|bayar|transfer|ajukan|setujui|tolak|hapus|batalkan|reservasi|gunakan|terima|sinkronkan|ekspor|impor|konfirmasi|update|create|save|approve|pay|delete)\b/.test(
      intent,
    )
  )
    return false;
  if (
    /\b(?:bagaimana|gimana|cara|kenapa|mengapa|saran|rekomendasi|sebaiknya|strategi|how|why|should)\b/.test(
      q,
    )
  )
    return false;
  const hasPeriod =
    /\b(hari ini|kemarin|today|yesterday|bulan ini|bulan lalu|this month|last month|minggu ini|minggu lalu|tahun ini|tahun lalu|besok|bulan depan|tahun depan|forecast|prediksi|historis|sebelumnya|banding\w*|compare|periode)\b/.test(
      q,
    ) ||
    /\b\d{4}-\d{2}(?:-\d{2})?\b/.test(q) ||
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(q) ||
    new RegExp(`\\b(${monthPattern})(?:\\s*\\d{4})?\\b`).test(q);
  return (
    hasPeriod &&
    (financialHistoryDomains(q).length > 0 ||
      /\b(saldo|balance|budget|anggaran|stok|stock|margin|realisasi)\b/.test(q))
  );
}
/** Deterministic parsing of the ORIGINAL human question. Model-provided dates are never inputs. */
export function parseFinancialHistoryRequest(question: string, now: Date): FinancialHistoryRequest {
  const q = question
    .toLocaleLowerCase("id-ID")
    .replace(
      /\b(?:jangan|tanpa)\s+(?:simpan|ubah|bayar|konfirmasi|mutasi|mengubah|menyimpan)(?:\s+(?:data|saldo|budget|stok|kas|dan|,))*\b/g,
      "",
    );
  const domains = financialHistoryDomains(q);
  const comparison = /\b(banding\w*|compare|versus|vs|dibandingkan)\b/.test(q);
  const bad = (error: string): FinancialHistoryRequest => ({
    domains,
    periods: [],
    comparison,
    error,
  });
  if (!Number.isFinite(now.getTime())) return bad("Waktu acuan laporan tidak valid.");
  if (/\b(forecast|prediksi|proyeksi|besok|bulan depan|tahun depan)\b/.test(q))
    return bad(
      "Prediksi belum tersedia. Laporan ini hanya menghitung catatan pengeluaran dan arus kas yang sudah tersimpan.",
    );
  // Recorded consumption costs are expense records, not an inventory-level
  // snapshot. Exempt only that explicit cost phrase; another stock-level
  // request in the same question still hits the snapshot guard below.
  const snapshotQuestion = q.replace(
    /\b(?:biaya|nilai|nominal|pengeluaran|ongkos)\s+(?:pemakaian|penggunaan|konsumsi)\s+(?:stok|stock|persediaan)\b(?!\s+(?:fisik|awal|akhir|tersedia|gudang|jumlah|kuantitas)\b)/g,
    "biaya konsumsi persediaan",
  );
  if (
    /\b(saldo|balance|budget|anggaran|stok|stock|margin|realisasi)\b/.test(snapshotQuestion) &&
    !/\b(rincian budget|tanpa mengubah (?:saldo|budget|stok))\b/.test(q)
  )
    return bad(
      "Riwayat saldo, alokasi/realisasi budget, margin, dan stok pada tanggal lampau belum tersedia sebagai snapshot terverifikasi. Nilai saat ini tidak digunakan untuk menggantikannya.",
    );
  if (!domains.length)
    return bad("Sebutkan pengeluaran tercatat atau arus kas untuk laporan periode.");
  const local = localParts(now);
  const found: { position: number; value: FinancialHistoryPeriod | null }[] = [];
  const covered: { start: number; end: number }[] = [];
  const push = (
    position: number,
    length: number,
    start: Date | null,
    end: Date | null,
    label: string,
  ): void => {
    covered.push({ start: position, end: position + length });
    found.push({ position, value: start && end ? period(start, end, now, label) : null });
  };
  const inCovered = (i: number): boolean => covered.some((r) => i >= r.start && i < r.end);
  const ranges =
    /\b(\d{4}-\d{2}-\d{2})\s*(?:sampai|hingga|s\.d\.|to|s\/d|–|—| - )\s*(\d{4}-\d{2}-\d{2})\b/g;
  for (const match of q.matchAll(ranges)) {
    const parse = (s: string): Date | null => {
      const [y, m, d] = s.split("-").map(Number);
      return validDate(y, m - 1, d);
    };
    const start = parse(match[1]),
      last = parse(match[2]);
    push(
      match.index,
      match[0].length,
      start,
      last ? new Date(last.getTime() + dayMs) : null,
      `${match[1]}–${match[2]}`,
    );
  }
  // A compact day range must be consumed before matching the terminal day/month.
  const sameMonthRanges = new RegExp(
    `\\b(\\d{1,2})\\s*(?:-|–|—|sampai|hingga|to)\\s*(\\d{1,2})\\s+(${monthPattern})\\s*(\\d{4})\\b`,
    "g",
  );
  for (const match of q.matchAll(sameMonthRanges)) {
    if (inCovered(match.index)) continue;
    const first = validDate(Number(match[4]), monthNames[match[3]], Number(match[1]));
    const last = validDate(Number(match[4]), monthNames[match[3]], Number(match[2]));
    push(
      match.index,
      match[0].length,
      first,
      last ? new Date(last.getTime() + dayMs) : null,
      first && last ? `${dateLabel(first)}–${dateLabel(last)}` : match[0],
    );
  }
  // Indonesian date-only input is DD/MM/YYYY and rendered with its full month name.
  const numericDates =
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*(?:sampai|hingga|to|–|—| - )\s*(\d{1,2})\/(\d{1,2})\/(\d{4}))?\b/g;
  for (const match of q.matchAll(numericDates)) {
    if (inCovered(match.index)) continue;
    const first = validDate(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    const last = match[4]
      ? validDate(Number(match[6]), Number(match[5]) - 1, Number(match[4]))
      : first;
    push(
      match.index,
      match[0].length,
      first,
      last ? new Date(last.getTime() + dayMs) : null,
      first && last
        ? match[4]
          ? `${dateLabel(first)}–${dateLabel(last)}`
          : dateLabel(first)
        : match[0],
    );
  }
  const dayDates = new RegExp(
    `\\b(\\d{1,2})\\s+(${monthPattern})\\s*(\\d{4})(?:\\s*(?:sampai|hingga|to|–|—)\\s*(\\d{1,2})\\s+(${monthPattern})\\s*(\\d{4}))?\\b`,
    "g",
  );
  for (const match of q.matchAll(dayDates)) {
    if (inCovered(match.index)) continue;
    const first = validDate(Number(match[3]), monthNames[match[2]], Number(match[1]));
    const last = match[4]
      ? validDate(Number(match[6]), monthNames[match[5]], Number(match[4]))
      : first;
    push(
      match.index,
      match[0].length,
      first,
      last ? new Date(last.getTime() + dayMs) : null,
      first && last
        ? match[4]
          ? `${dateLabel(first)}–${dateLabel(last)}`
          : dateLabel(first)
        : match[0],
    );
  }
  const relative =
    /\b(hari ini|kemarin|today|yesterday|bulan ini|bulan lalu|this month|last month)\b/g;
  for (const match of q.matchAll(relative)) {
    const month = /bulan|month/.test(match[0]);
    const previous = /kemarin|yesterday|lalu|last/.test(match[0]);
    const start = month
      ? dayStart(local.year, local.month - (previous ? 1 : 0), 1)
      : dayStart(local.year, local.month, local.day - (previous ? 1 : 0));
    const end = month
      ? dayStart(local.year, local.month + (previous ? 0 : 1), 1)
      : new Date(start.getTime() + dayMs);
    push(
      match.index,
      match[0].length,
      start,
      end,
      month
        ? start.toLocaleDateString("id-ID", {
            timeZone: FINANCIAL_HISTORY_TIME_ZONE,
            month: "long",
            year: "numeric",
          })
        : dateLabel(start),
    );
  }
  const iso = /\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/g;
  for (const match of q.matchAll(iso)) {
    if (inCovered(match.index)) continue;
    const year = Number(match[1]),
      month = Number(match[2]) - 1;
    const start = validDate(year, month, Number(match[3] ?? 1));
    const end = start
      ? match[3]
        ? new Date(start.getTime() + dayMs)
        : dayStart(year, month + 1, 1)
      : null;
    push(match.index, match[0].length, start, end, match[3] && start ? dateLabel(start) : match[0]);
  }
  if (
    new RegExp(
      `\\b\\d{1,2}\\s*(?:-|–|—|sampai|hingga|to)\\s*\\d{1,2}\\s+(${monthPattern})(?:\\s+\\d{4})?\\b`,
    ).test(q) &&
    !found.length
  )
    return bad("Rentang tanggal belum jelas. Gunakan tanggal awal dan akhir beserta tahun.");
  const months = new RegExp(`\\b(${monthPattern})\\s*(\\d{4})\\b`, "g");
  for (const match of q.matchAll(months)) {
    if (inCovered(match.index)) continue;
    const start = dayStart(Number(match[2]), monthNames[match[1]], 1);
    push(
      match.index,
      match[0].length,
      start,
      dayStart(Number(match[2]), monthNames[match[1]] + 1, 1),
      start.toLocaleDateString("id-ID", {
        timeZone: FINANCIAL_HISTORY_TIME_ZONE,
        month: "long",
        year: "numeric",
      }),
    );
  }
  found.sort((a, b) => a.position - b.position);
  if (!found.length)
    return bad(
      "Sebutkan tanggal atau bulan beserta tahunnya; atau gunakan hari ini, kemarin, bulan ini, atau bulan lalu.",
    );
  if (found.some((entry) => !entry.value))
    return bad(
      "Periode tidak valid, belum dimulai, atau lebih dari 366 hari. Gunakan maksimal dua periode sampai waktu sekarang.",
    );
  const periods: FinancialHistoryPeriod[] = [];
  for (const entry of found)
    if (
      entry.value &&
      !periods.some(
        (p) => p.start === entry.value?.start && p.requestedEnd === entry.value?.requestedEnd,
      )
    )
      periods.push(entry.value);
  if (periods.length > 2 || (comparison && periods.length !== 2))
    return bad(
      "Perbandingan memerlukan tepat dua periode yang jelas. Sebutkan keduanya beserta tahun untuk bulan/tanggal tertentu.",
    );
  return { domains, periods, comparison, error: null };
}
export function aggregateHistoricalExpenses(
  rows: readonly HistoricalExpenseAggregate[],
): z.infer<typeof historicalExpenseTotalsSchema> {
  let recorded = 0n,
    pending = 0n,
    excluded = 0n,
    recordedCount = 0,
    pendingCount = 0,
    excludedCount = 0;
  const groups = rows.map((row) => {
    const amount = parseNumericToCents(row.amount ?? "0");
    if (amount >= 0n && ["VERIFIED", "APPROVED", "PAID"].includes(row.status)) {
      recorded += amount;
      recordedCount += row.count;
    } else if (amount >= 0n && row.status === "SUBMITTED") {
      pending += amount;
      pendingCount += row.count;
    } else {
      excluded += amount < 0n ? -amount : amount;
      excludedCount += row.count;
    }
    return { ...row, amount: fromCents(amount) };
  });
  return {
    recordedExpenseAmount: fromCents(recorded),
    recordedCount,
    pendingAmount: fromCents(pending),
    pendingCount,
    excludedAmount: fromCents(excluded),
    excludedCount,
    groups,
  };
}
export function aggregateHistoricalCash(
  rows: readonly CashFlowAggregate[],
): z.infer<typeof historicalCashTotalsSchema> {
  const exclusions = {
    opening: { count: 0, amount: 0n },
    transfer: { count: 0, amount: 0n },
    adjustment: { count: 0, amount: 0n },
    unclassified: { count: 0, amount: 0n },
  };
  let incoming = 0n,
    outgoing = 0n,
    transactionCount = 0;
  for (const row of rows) {
    const amount = parseNumericToCents(row.amount ?? "0");
    let classification = classifyCashFlow(row);
    let direction: "INFLOW" | "OUTFLOW" | null = null;
    try {
      direction = normalizeCashDirection(row.type);
    } catch {
      classification = "unclassified";
    }
    if (amount < 0n) classification = "unclassified";
    if (classification !== "included") {
      exclusions[classification].count += row.count;
      exclusions[classification].amount += amount < 0n ? -amount : amount;
    } else {
      transactionCount += row.count;
      if (direction === "INFLOW") incoming += amount;
      else outgoing += amount;
    }
  }
  const expose = (entry: { count: number; amount: bigint }): { count: number; amount: string } => ({
    count: entry.count,
    amount: fromCents(entry.amount),
  });
  return {
    transactionCount,
    cashIn: fromCents(incoming),
    cashOut: fromCents(outgoing),
    net: fromCents(incoming - outgoing),
    exclusions: {
      opening: expose(exclusions.opening),
      transfer: expose(exclusions.transfer),
      adjustment: expose(exclusions.adjustment),
      unclassified: expose(exclusions.unclassified),
    },
  };
}
/** Exact basis-point percent; the prior period is the denominator, never the new period. */
export function compareHistoricalAmount(
  current: string,
  previous: string,
): { delta: string; percent: string | null; zeroBase: boolean } {
  const latest = parseNumericToCents(current),
    prior = parseNumericToCents(previous),
    delta = latest - prior;
  if (prior === 0n) return { delta: fromCents(delta), percent: null, zeroBase: true };
  const absolute = prior < 0n ? -prior : prior;
  const scaled = (delta * 10_000n) / absolute;
  return { delta: fromCents(delta), percent: fromCents(scaled), zeroBase: false };
}

/** A name that merely prefixes another entity is not an explicit choice. */
export function bindsFinancialHistoryEntity(question: string, name: string, id: string): boolean {
  const q = question.toLocaleLowerCase("id-ID"),
    n = name.toLocaleLowerCase("id-ID").trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) &&
    q.includes(id.toLowerCase())
  )
    return true;
  if (!n) return false;
  const allowedTail =
    /^(?:bulan|hari|kemarin|today|yesterday|pada|tanggal|periode|dibandingkan|dibanding|versus|vs|dan|dengan|untuk|yang|saat|sekarang|tahun|jangan|tanpa|this|last|dari|berapa|adalah|\d+(?:[.-]\d+)*|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|may|june|july|august|october|december|jan|feb|mar|apr|jun|jul|agu|ags|sep|sept|okt|oct|nov|des|dec)\b/;
  let offset = 0;
  while (offset < q.length) {
    const index = q.indexOf(n, offset);
    if (index < 0) return false;
    offset = index + n.length;
    const before = q[index - 1],
      after = q[offset];
    if ((before && /[\p{L}\p{N}]/u.test(before)) || (after && /[\p{L}\p{N}]/u.test(after)))
      continue;
    const tail = q.slice(offset).trimStart();
    if (!tail || /^[,.;:?!()[\]"'”\n]/.test(tail) || allowedTail.test(tail)) return true;
  }
  return false;
}
