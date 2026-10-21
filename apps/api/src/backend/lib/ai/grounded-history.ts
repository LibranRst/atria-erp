import {
  compareHistoricalAmount,
  bindsFinancialHistoryEntity,
  financialHistoryOutputSchema,
  isFinancialHistoryQuestion,
  parseFinancialHistoryRequest,
  type FinancialHistoryOutput,
} from "@atria/core/ai/financial-history";
import { fromCents, parseNumericToCents } from "@atria/core/finance/money-minor";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { formatExactIdr, formatIdr } from "@atria/core/utils/money";
import { z } from "zod";
import type { GroundedAnswer, GroundedFactSource, GroundedToolObservation } from "./grounded-facts";
const object = z.record(z.string(), z.unknown());
function plain(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\`*_[\]<>]/g, "")
    .trim();
}
function amount(value: string): string {
  const cents = parseNumericToCents(value);
  if (cents <= BigInt(Number.MAX_SAFE_INTEGER) && cents >= -BigInt(Number.MAX_SAFE_INTEGER)) {
    return cents % 100n === 0n ? formatIdr(Number(value)) : formatExactIdr(Number(value));
  }
  const negative = cents < 0n,
    absolute = negative ? -cents : cents;
  return `Rp ${negative ? "-" : ""}${(absolute / 100n).toLocaleString("id-ID")}${absolute % 100n === 0n ? "" : `,${String(absolute % 100n).padStart(2, "0")}`}`;
}
function validScope(question: string, value: FinancialHistoryOutput): boolean {
  if (value.scope.kind === "project")
    return bindsFinancialHistoryEntity(
      question,
      value.scope.projectName ?? "",
      value.scope.projectId ?? "",
    );
  if (value.scope.kind === "account")
    return bindsFinancialHistoryEntity(
      question,
      value.scope.accountName ?? "",
      value.scope.accountId ?? "",
    );
  const q = question.toLocaleLowerCase("id-ID");
  if (
    /\b(proyek|project|rekening|account)\b/.test(q) &&
    !/\b(seluruh|semua|perusahaan|company|all|ditugaskan|saya)\b/.test(q)
  )
    return false;
  return true;
}
function comparison(label: string, latest: string, prior: string): string {
  const delta = compareHistoricalAmount(latest, prior);
  return `${label}: selisih ${amount(delta.delta)}${delta.zeroBase ? "; persentase tidak dihitung karena periode pembanding bernilai nol." : ` (${delta.percent?.replace(".", ",")}% terhadap periode pembanding).`}`;
}
function expenseText(
  value: NonNullable<FinancialHistoryOutput["periods"][number]["expenses"]>,
  question: string,
): { text: string; total: string } {
  const q = question.toLocaleLowerCase("id-ID");
  const names = Array.from(
    new Set([
      ...value.groups.map((g) => g.categoryName),
      "Material",
      "Tukang",
      "Operasional",
      "Lain-lain",
      "Subcon",
    ]),
  );
  const categories = names.filter((name) => {
    const escaped = name.toLocaleLowerCase("id-ID").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `\\b(?:kategori|pengeluaran|biaya|belanja)\\s+(?:kategori\\s+)?${escaped}(?=$|[^\\p{L}\\p{N}])`,
      "u",
    ).test(q);
  });
  const statusFilter = /\b(menunggu|diajukan|pending|submitted)\b/.test(q)
    ? "SUBMITTED"
    : /\b(dibayar|paid)\b/.test(q)
      ? "PAID"
      : /\b(ditolak|rejected)\b/.test(q)
        ? "REJECTED"
        : /\b(terverifikasi|verified)\b/.test(q)
          ? "VERIFIED"
          : /\b(disetujui|approved)\b/.test(q)
            ? "APPROVED"
            : undefined;
  const rows = value.groups.filter(
    (g) =>
      (!categories.length || categories.includes(g.categoryName)) &&
      (!statusFilter || g.status === statusFilter),
  );
  const qualified = categories.length > 0 || statusFilter !== undefined;
  const selected = qualified
    ? fromCents(
        rows
          .filter((g) => statusFilter || ["VERIFIED", "APPROVED", "PAID"].includes(g.status))
          .reduce((sum, g) => sum + parseNumericToCents(g.amount), 0n),
      )
    : value.recordedExpenseAmount;
  const count = qualified
    ? rows
        .filter((g) => statusFilter || ["VERIFIED", "APPROVED", "PAID"].includes(g.status))
        .reduce((sum, g) => sum + g.count, 0)
    : value.recordedCount;
  const label = statusFilter
    ? `Pengeluaran berstatus ${formatBusinessLabel(statusFilter)}`
    : "Biaya tercatat (terverifikasi/disetujui/dibayar)";
  const lines = [
    `${label}${categories.length ? ` · ${categories.map(plain).join(", ")}` : ""}: **${amount(selected)}** · ${count} catatan.`,
  ];
  if (!statusFilter) {
    const pending = qualified
      ? fromCents(
          rows
            .filter((g) => g.status === "SUBMITTED")
            .reduce((sum, g) => sum + parseNumericToCents(g.amount), 0n),
        )
      : value.pendingAmount;
    const excluded = qualified
      ? fromCents(
          rows
            .filter((g) => !["VERIFIED", "APPROVED", "PAID", "SUBMITTED"].includes(g.status))
            .reduce((sum, g) => sum + parseNumericToCents(g.amount), 0n),
        )
      : value.excludedAmount;
    lines.push(
      `Pengajuan menunggu: ${amount(pending)}. Di luar biaya tercatat (ditolak/status lain, termasuk aset persediaan): ${amount(excluded)}.`,
    );
  }
  if (rows.some((g) => g.sourceType === "STOCK_USAGE" && parseNumericToCents(g.amount) !== 0n))
    lines.push("Biaya pemakaian stok dapat termasuk di atas; nominal ini bukan kas yang dibayar.");
  return { text: lines.join("\n"), total: selected };
}
/** Current-generation executed report only; the original human question independently binds periods and entities. */
export function renderGroundedHistory(
  question: string,
  observations: readonly GroundedToolObservation[],
  availableTools?: readonly string[],
  referenceTime?: Date,
): GroundedAnswer | null {
  if (!isFinancialHistoryQuestion(question)) return null;
  const empty = (text: string, status: GroundedAnswer["status"] = "waiting"): GroundedAnswer => ({
    status,
    text,
    sources: [],
    coveredDomains: [],
    missingDomains: ["history"],
  });
  // These are permanent capability limits, not missing reads. No executed
  // report/current balance may turn a past snapshot or forecast into a fact.
  // The clock is used only for policy classification here; numerical reports
  // still independently rebind their executed server asOf below.
  const policy = parseFinancialHistoryRequest(question, referenceTime ?? new Date());
  if (policy.error && /^(?:Riwayat saldo,|Prediksi belum tersedia\.)/.test(policy.error))
    return empty(policy.error, "error");
  if (availableTools && !availableTools.includes("getFinancialHistory"))
    return empty(
      "Pembacaan riwayat pengeluaran/arus kas lewat AI tidak tersedia untuk izin Anda saat ini.",
      "error",
    );
  const reads = observations.filter((o) => o.toolName === "getFinancialHistory");
  if (!reads.length)
    return empty(
      "Riwayat belum terverifikasi. Saya perlu membaca laporan periode yang Anda minta; nilai saat ini tidak menggantikan riwayat.",
    );
  const last = reads.at(-1);
  if (!last) return empty("Laporan periode belum tersedia.");
  const raw = object.safeParse(last.output).data;
  if (raw && typeof raw.error === "string")
    return empty(plain(raw.error), raw.needsDisambiguation === true ? "waiting" : "error");
  const parsed = financialHistoryOutputSchema.safeParse(last.output);
  if (!parsed.success)
    return empty(
      "Hasil laporan periode belum lengkap atau tidak valid; angka belum dapat diverifikasi.",
    );
  const value = parsed.data;
  const request = parseFinancialHistoryRequest(question, new Date(value.asOf));
  if (request.error) return empty(request.error);
  const expected = request.periods.map(({ start, end, requestedEnd, isPartial }) => ({
    start,
    end,
    requestedEnd,
    isPartial,
  }));
  const actual = value.periods.map(({ start, end, requestedEnd, isPartial }) => ({
    start,
    end,
    requestedEnd,
    isPartial,
  }));
  if (
    JSON.stringify(expected) !== JSON.stringify(actual) ||
    value.comparison !== request.comparison
  )
    return empty(
      "Periode hasil pembacaan tidak sesuai pertanyaan Anda. Minta laporan periode yang benar sebelum menggunakan angkanya.",
    );
  if (!validScope(question, value))
    return empty(
      "Cakupan laporan belum sesuai proyek/rekening yang Anda maksud. Sebutkan satu nama atau pilih cakupannya terlebih dahulu.",
    );
  const texts = [`**${plain(value.scope.label)}**`];
  let complete = value.issues.length === 0;
  const expenseTotals: string[] = [];
  for (const p of value.periods) {
    texts.push(`**${plain(p.label)}${p.isPartial ? " · berjalan" : ""}**`);
    if (request.domains.includes("expenses")) {
      if (p.expenses) {
        const expense = expenseText(
          p.expenses,
          question.replace(
            new RegExp(
              (value.scope.projectName ?? value.scope.accountName ?? "\u0000").replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&",
              ),
              "giu",
            ),
            "",
          ),
        );
        texts.push(expense.text);
        expenseTotals.push(expense.total);
      } else {
        complete = false;
        texts.push("Riwayat pengeluaran belum tersedia untuk cakupan/izin ini.");
      }
    }
    if (request.domains.includes("cash")) {
      if (p.cash) {
        texts.push(
          `Kas masuk: **${amount(p.cash.cashIn)}**. Kas keluar: **${amount(p.cash.cashOut)}**. Arus kas bersih: **${amount(p.cash.net)}** · ${p.cash.transactionCount} transaksi.`,
        );
        const exclusions = Object.entries(p.cash.exclusions).filter(([, e]) => e.count > 0);
        const labels: Readonly<Record<string, string>> = {
          opening: "saldo awal",
          transfer: "transfer internal",
          adjustment: "penyesuaian",
          unclassified: "belum terklasifikasi",
        };
        texts.push(
          exclusions.length
            ? `Tidak masuk arus kas: ${exclusions.map(([key, e]) => `${labels[key]} ${amount(e.amount)} (${e.count} transaksi)`).join("; ")}.`
            : "Saldo awal, transfer internal dan penyesuaian dikecualikan dari arus kas (tidak ada pada periode ini).",
        );
      } else {
        complete = false;
        texts.push("Riwayat arus kas belum tersedia untuk cakupan/izin ini.");
      }
    }
  }
  if (request.comparison && value.periods.length === 2) {
    const laterIndex = value.periods[0].start > value.periods[1].start ? 0 : 1,
      earlierIndex = laterIndex === 0 ? 1 : 0;
    const later = value.periods[laterIndex],
      earlier = value.periods[earlierIndex];
    texts.push(`**Perubahan ${plain(later.label)} terhadap ${plain(earlier.label)}**`);
    if (expenseTotals.length === 2)
      texts.push(
        comparison(
          "Nominal pengeluaran yang diminta",
          expenseTotals[laterIndex],
          expenseTotals[earlierIndex],
        ),
      );
    if (later.cash && earlier.cash && request.domains.includes("cash")) {
      texts.push(
        comparison("Kas masuk", later.cash.cashIn, earlier.cash.cashIn),
        comparison("Kas keluar", later.cash.cashOut, earlier.cash.cashOut),
        comparison("Arus kas bersih", later.cash.net, earlier.cash.net),
      );
    }
    if (later.isPartial || earlier.isPartial)
      texts.push(
        "Periode berjalan belum sebulan/hari penuh; perbandingan memakai catatan sampai waktu acuan, bukan proyeksi akhir periode.",
      );
  }
  texts.push(
    "Dasar tanggal: pengeluaran memakai tanggal biaya; arus kas memakai tanggal buku kas, bukan tanggal impor/rekonsiliasi. Batas periode mengikuti Asia/Jakarta. Status pengeluaran adalah status saat laporan dibaca, bukan riwayat perubahan persetujuan.",
  );
  texts.push(
    `Dibaca sampai ${new Date(value.asOf).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB. Nominal pengeluaran, konsumsi budget Material dan pembayaran kas merupakan ukuran berbeda.`,
  );
  if (value.issues.length) texts.push(...value.issues.map(plain));
  const source: GroundedFactSource = {
    toolName: last.toolName,
    toolCallId: last.toolCallId,
    entityIds: [value.scope.projectId, value.scope.accountId].filter((id): id is string =>
      Boolean(id),
    ),
    query: {
      ...object.safeParse(last.input).data,
      periods: expected,
      asOf: value.asOf,
      timeZone: value.timeZone,
      dateBasis: { expenses: "expenseDate", cash: "cashTransaction.createdAt" },
      scope: value.scope.kind,
    },
  };
  return {
    status: complete ? "verified" : "partial",
    text: texts.join("\n\n"),
    sources: [source],
    coveredDomains: complete ? ["history"] : [],
    missingDomains: complete ? [] : ["history"],
  };
}
