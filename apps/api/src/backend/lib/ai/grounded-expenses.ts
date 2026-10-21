import { z } from "zod";
import { getRecentExpensesOutputSchema } from "@atria/core/ai/tool-output";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { formatExactIdr, formatIdr } from "@atria/core/utils/money";
import {
  isFinancialHistoryQuestion,
  parseFinancialHistoryRequest,
  type FinancialHistoryPeriod,
} from "@atria/core/ai/financial-history";
import type { GroundedFactSource, GroundedToolObservation } from "./grounded-facts";

/** The main renderer supplies its conservative exact entity/name matcher. */
export type ExpenseEntityBinder = (question: string, name: string, id: string) => boolean;
export interface GroundedExpenseSection {
  readonly text: string;
  readonly source: GroundedFactSource;
  readonly complete: boolean;
  readonly needsChoice?: boolean;
}
const statuses = z.enum([
  "SUBMITTED",
  "VERIFIED",
  "APPROVED",
  "REJECTED",
  "PAID",
  "INVENTORY_ASSET",
]);
const paymentStatuses = z.enum(["PAID", "UNPAID", "PARTIALLY_PAID", "NON_CASH"]);
const recordSchema = z.record(z.string(), z.unknown());
const exactAmountSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
interface ExpenseFact {
  readonly id: string;
  readonly projectCostId?: string | null;
  readonly projectId: string;
  readonly projectName: string;
  readonly description: string;
  readonly categoryName?: string;
  readonly status: z.infer<typeof statuses>;
  readonly paymentStatus?: string;
  readonly amount: number;
  readonly date?: string;
  readonly sourceType?: string;
  readonly isCashImpact?: boolean;
  readonly descriptionMatchesInScope?: number;
}
interface ExpensePage {
  readonly rows: readonly ExpenseFact[];
  readonly hasMore: boolean;
  readonly offset: number;
  readonly matchedCount?: number;
  readonly requiresChoice: boolean;
  readonly project?: { readonly id: string; readonly name: string };
  readonly dateRange?: FinancialHistoryPeriod & { readonly asOf: string };
}
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function plain(value: string): string {
  return value
    .replace(/[\r\n`*_<>]/g, " ")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replace(/\s+/g, " ")
    .trim();
}
/** Routes even unsupported past-state questions to status clarification, not totals. */
export function isExpenseStatusQuestion(question: string): boolean {
  const text = normalize(question);
  return (
    /\b(?:pengeluaran|expense|biaya lapangan)\b/.test(text) &&
    /\b(?:status|lunas|dibayar|disetujui|diajukan|terverifikasi|ditolak)\b/.test(text)
  );
}
/** Current state may be read for old records, but no past approval snapshot exists. */
export function isSupportedCurrentExpenseStatusQuestion(question: string): boolean {
  const text = normalize(question);
  if (!isExpenseStatusQuestion(question)) return false;
  if (
    /\b(?:status saat itu|status sebelumnya|status per|sudah disetujui per|as of|pada waktu|pada saat)\b/.test(
      text,
    )
  )
    return false;
  const dated = isFinancialHistoryQuestion(question) || /\b(?:minggu lalu|tahun lalu)\b/.test(text);
  if (!dated) return true;
  const current = /\b(?:saat ini|sekarang|terkini|current|hari ini|today)\b/.test(text);
  const recordsDated =
    /\b(?:pengeluaran|expense|biaya lapangan)\s+(?:yang\s+)?(?:tercatat|diajukan|pada tanggal|tanggal)\b/.test(
      text,
    );
  return current || recordsDated;
}
function exactAmount(exact: unknown, fallback: number): number | null {
  if (exact !== undefined) {
    const parsed = exactAmountSchema.safeParse(exact);
    if (!parsed.success) return null;
    const amount = Number(parsed.data);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }
  return Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
}
function readPage(observation: GroundedToolObservation): ExpensePage | null {
  if (observation.toolName === "getRecentExpenses") {
    const parsed = getRecentExpensesOutputSchema.safeParse(observation.output);
    if (!parsed.success) return null;
    const result = parsed.data;
    // Old recent pages have neither stable identities nor reliable page bounds.
    if (result.hasMore === undefined || result.offset === undefined) return null;
    const rows: ExpenseFact[] = [];
    for (const row of result.expenses) {
      const status = statuses.safeParse(row.status).data;
      const amount = exactAmount(row.exactAmount, row.amount.amount);
      if (
        !row.id ||
        !row.projectId ||
        !status ||
        amount === null ||
        !paymentStatuses.safeParse(row.paymentStatus).success
      )
        return null;
      rows.push({
        id: row.id,
        projectCostId: row.projectCostId,
        projectId: row.projectId,
        projectName: row.projectName,
        description: row.description,
        categoryName: row.categoryName,
        status,
        paymentStatus: row.paymentStatus,
        amount,
        date: row.expenseDate,
        sourceType: row.sourceType,
        isCashImpact: row.isCashImpact,
        descriptionMatchesInScope: row.descriptionMatchesInScope,
      });
    }
    return {
      rows,
      hasMore: result.hasMore,
      offset: result.offset,
      matchedCount: result.matchedCount,
      requiresChoice: result.requiresExpenseChoice === true,
      project: result.project,
      dateRange: result.dateRange,
    };
  }
  if (observation.toolName !== "getExpenseBatchContext") return null;
  const schema = z.object({
    project: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    nextCostOffset: z.number().int().nonnegative().nullable(),
    expenses: z.array(
      z.object({
        id: z.string().min(1),
        description: z.string(),
        amount: z.number().finite(),
        exactAmount: exactAmountSchema.optional(),
        statusCode: statuses,
        paymentStatus: paymentStatuses.optional(),
        categoryName: z.string().optional(),
      }),
    ),
  });
  const parsed = schema.safeParse(observation.output);
  if (!parsed.success) return null;
  const input = recordSchema.safeParse(observation.input).data ?? {};
  if (input.projectId !== parsed.data.project.id) return null;
  const rows: ExpenseFact[] = [];
  for (const row of parsed.data.expenses) {
    const amount = exactAmount(row.exactAmount, row.amount);
    if (amount === null) return null;
    rows.push({
      ...row,
      status: row.statusCode,
      projectId: parsed.data.project.id,
      projectName: parsed.data.project.name,
      amount,
    });
  }
  return {
    rows,
    hasMore: parsed.data.nextCostOffset !== null,
    offset: typeof input.offset === "number" ? input.offset : 0,
    requiresChoice: false,
    project: parsed.data.project,
  };
}
function inputMatchesQuestion(
  question: string,
  input: Record<string, unknown>,
  serverDateBound: boolean,
): boolean {
  const text = normalize(question);
  for (const key of ["query", "projectQuery"]) {
    const value = input[key];
    if (typeof value === "string" && (value.trim().length < 2 || !text.includes(normalize(value))))
      return false;
  }
  if (typeof input.status === "string") {
    const aliases: Readonly<Record<string, RegExp>> = {
      SUBMITTED: /\b(?:diajukan|pengajuan|submitted)\b/,
      VERIFIED: /\b(?:terverifikasi|diverifikasi|verified)\b/,
      APPROVED: /\b(?:disetujui|approved|siap bayar)\b/,
      REJECTED: /\b(?:ditolak|rejected)\b/,
      PAID: /\b(?:lunas|dibayar|paid)\b/,
      INVENTORY_ASSET: /\b(?:aset|persediaan|pembelian stok)\b/,
    };
    if (!aliases[input.status]?.test(text)) return false;
  }
  if (
    typeof input.categoryCode === "string" &&
    !text.includes(normalize(formatBusinessLabel(input.categoryCode)))
  )
    return false;
  // Explicit date filters must occur in the original user question. Human period
  // comparisons belong to the historical report, never model-invented dates.
  for (const key of serverDateBound ? [] : ["dateFrom", "dateTo"]) {
    const value = input[key];
    if (typeof value === "string" && !question.includes(value)) return false;
  }
  return true;
}

/** Current-generation executed results only; never pass stored conversation tools. */
export function renderGroundedExpenseSection(
  question: string,
  observation: GroundedToolObservation,
  bindEntity: ExpenseEntityBinder,
): GroundedExpenseSection | null {
  const text = normalize(question);
  if (!/\b(?:pengeluaran|expense|biaya lapangan)\b/.test(text)) return null;
  if (isExpenseStatusQuestion(question) && !isSupportedCurrentExpenseStatusQuestion(question))
    return null;
  const input = recordSchema.safeParse(observation.input).data ?? {};
  const page = readPage(observation);
  if (!page) return null;
  const request = page.dateRange
    ? parseFinancialHistoryRequest(question, new Date(page.dateRange.asOf))
    : null;
  const period = request?.periods[0];
  const serverDateBound = Boolean(
    period &&
    !request?.error &&
    request?.periods.length === 1 &&
    period.start === page.dateRange?.start &&
    period.end === page.dateRange.end &&
    period.requestedEnd === page.dateRange.requestedEnd &&
    period.isPartial === page.dateRange.isPartial,
  );
  if (
    (page.dateRange && !serverDateBound) ||
    (isFinancialHistoryQuestion(question) && !serverDateBound) ||
    !inputMatchesQuestion(question, input, serverDateBound)
  )
    return null;
  if (
    typeof input.projectId === "string" &&
    !question.includes(input.projectId) &&
    !(page.project && bindEntity(question, page.project.name, page.project.id)) &&
    !page.rows.some((row) => bindEntity(question, row.projectName, row.projectId))
  )
    return null;
  const explicitExpenseId =
    typeof input.expenseId === "string" && question.includes(input.expenseId);
  let unverifiedNamedIdentity = false;
  let ambiguousNamedIdentity = false;
  if (typeof input.expenseId === "string") {
    const target = page.rows[0];
    if (
      !target ||
      page.rows.length !== 1 ||
      (target.id !== input.expenseId && target.projectCostId !== input.expenseId) ||
      (!explicitExpenseId && !bindEntity(question, target.description, target.id))
    )
      return null;
    // The backend uniqueness comparison case-folds a complete literal name.
    // Keep the proof equally strict here; normalizing punctuation/whitespace
    // alone cannot identify one similarly named transaction via a model ID.
    const literalNamed = question
      .toLocaleLowerCase("id-ID")
      .includes(target.description.toLocaleLowerCase("id-ID"));
    unverifiedNamedIdentity =
      !explicitExpenseId && (target.descriptionMatchesInScope !== 1 || !literalNamed);
    ambiguousNamedIdentity = unverifiedNamedIdentity && (target.descriptionMatchesInScope ?? 0) > 1;
  }
  // A page is never an aggregate, personal requester scope, or past status proof.
  if (/\b(?:total|jumlah nominal|akumulasi|sum|pengeluaran saya|status kemarin)\b/.test(text))
    return null;
  const source = (rows: readonly ExpenseFact[]): GroundedFactSource => ({
    toolName: observation.toolName,
    toolCallId: observation.toolCallId,
    entityIds: [
      ...new Set(
        rows.flatMap((row) => [
          row.projectId,
          row.id,
          ...(row.projectCostId ? [row.projectCostId] : []),
        ]),
      ),
    ],
    query: { ...input, ...(page.dateRange ? { resolvedDateRange: page.dateRange } : {}) },
  });
  const byIdentity = page.rows.filter(
    (row) =>
      bindEntity(question, row.description, row.id) ||
      Boolean(row.projectCostId && question.includes(row.projectCostId)),
  );
  const genericList =
    /\b(?:semua|seluruh|daftar|terakhir|terbaru|terkini)\b/.test(text) ||
    Boolean(page.project && bindEntity(question, page.project.name, page.project.id)) ||
    page.rows.some((row) => bindEntity(question, row.projectName, row.projectId));
  if (!byIdentity.length && !genericList) {
    if (
      !page.rows.length &&
      typeof input.query === "string" &&
      page.offset === 0 &&
      !page.hasMore
    ) {
      return {
        text: `Tidak ditemukan pengeluaran dengan deskripsi "${plain(input.query)}" dalam akses Anda.`,
        source: source([]),
        complete: true,
      };
    }
    return null;
  }
  const selected = byIdentity.length ? byIdentity : page.rows;
  const targetClause = text.match(
    /\b(?:pengeluaran|expense|biaya lapangan)\s+(.+?)(?:\s+(?:pada|di|sekarang|saat ini|tanggal)\b|$)/,
  )?.[1];
  const names = selected.flatMap((row) => [normalize(row.description), normalize(row.projectName)]);
  const missingNamedTargets = Boolean(
    targetClause?.includes(" dan ") &&
    targetClause
      .split(/\s+(?:dan|serta)\s+/)
      .some(
        (part) =>
          !names.some((name) => part.includes(name)) &&
          !/\b(?:saldo|budget|anggaran|stok|rap|rab|tagihan|rekening)\b/.test(part),
      ),
  );
  const duplicateDescription =
    byIdentity.length > 1 &&
    new Set(byIdentity.map((row) => normalize(row.description))).size < byIdentity.length;
  const needsChoice =
    (!explicitExpenseId && page.requiresChoice) || duplicateDescription || ambiguousNamedIdentity;
  const amountLabel = (amount: number): string =>
    Number.isInteger(amount) ? formatIdr(amount) : formatExactIdr(amount);
  const lines = selected.map((row) => {
    const statusLabel =
      row.status === "INVENTORY_ASSET"
        ? "Pembelian persediaan (aset)"
        : formatBusinessLabel(row.status);
    const paymentLabel =
      row.paymentStatus === "NON_CASH"
        ? "Pencatatan nonkas"
        : row.paymentStatus
          ? formatBusinessLabel(row.paymentStatus)
          : undefined;
    return `- ${plain(row.description)} · ${plain(row.projectName)}${row.categoryName ? ` · ${plain(row.categoryName)}` : ""}${row.date ? ` · ${plain(row.date)}` : ""}: ${statusLabel}; nominal tercatat ${amountLabel(row.amount)}${paymentLabel ? `; ${paymentLabel}` : ""}${row.status === "INVENTORY_ASSET" ? "; belum menjadi biaya pemakaian Material" : row.sourceType === "STOCK_USAGE" ? "; pemakaian Material tanpa pembayaran kas baru" : ""}.`;
  });
  const inconsistent = selected.some(
    (row) =>
      row.paymentStatus !== undefined &&
      row.status !== "INVENTORY_ASSET" &&
      row.paymentStatus !== "NON_CASH" &&
      (row.status === "PAID") !== (row.paymentStatus === "PAID"),
  );
  const incomplete =
    page.hasMore ||
    page.offset > 0 ||
    (page.matchedCount !== undefined && page.matchedCount !== page.rows.length);
  return {
    text: [
      "Status pengeluaran saat ini:",
      ...lines,
      ...(page.dateRange
        ? [
            `Tanggal pengeluaran: ${plain(page.dateRange.label)} · Asia/Jakarta${page.dateRange.isPartial ? " (periode berjalan sampai waktu pemeriksaan)" : ""}. Status di atas adalah status saat ini, bukan status historis pada tanggal tersebut.`,
          ]
        : []),
      ...(!selected.length
        ? ["Belum ada pengeluaran yang cocok dengan filter ini dalam akses Anda."]
        : []),
      ...(needsChoice
        ? [
            "Ada beberapa pengeluaran yang cocok. Pilih berdasarkan proyek dan tanggal sebelum menentukan satu transaksi.",
          ]
        : []),
      ...(missingNamedTargets && !needsChoice
        ? [
            "Belum semua pengeluaran yang disebutkan telah dibaca; status pengeluaran berikutnya masih perlu diverifikasi.",
          ]
        : []),
      ...(unverifiedNamedIdentity && !ambiguousNamedIdentity
        ? [
            "Nama pengeluaran belum terbukti unik dalam cakupan pembacaan; pilih proyek atau tanggal untuk memverifikasi transaksi yang dimaksud.",
          ]
        : []),
      ...(incomplete
        ? [
            "Ini sebagian hasil dalam akses Anda; lanjutkan halaman berikutnya. Nominal di atas bukan total pengeluaran proyek.",
          ]
        : []),
      ...(inconsistent
        ? ["Status pengeluaran dan pembayaran tidak selaras; periksa sumber sebelum melanjutkan."]
        : []),
    ].join("\n"),
    source: source(selected),
    complete:
      !needsChoice &&
      !incomplete &&
      !inconsistent &&
      !missingNamedTargets &&
      !unverifiedNamedIdentity,
    ...(needsChoice ? { needsChoice: true } : {}),
  };
}
