import { z } from "zod";
import {
  isFinancialHistoryQuestion,
  parseFinancialHistoryRequest,
  stripQuotedEntitiesForIntent,
} from "@atria/core/ai/financial-history";
import { renderGroundedHistory } from "./grounded-history";
import { isExpenseStatusQuestion, renderGroundedExpenseSection } from "./grounded-expenses";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { formatExactIdr, formatIdr } from "@atria/core/utils/money";
import type { CardNarrative } from "@atria/core/ai/answer-presentation";
import { selectVisibleBudgetCategories } from "@atria/core/ai/budget-card-presentation";
import {
  getBankBalancesOutputSchema,
  getProjectBudgetOutputSchema,
  getProjectHealthOutputSchema,
} from "@atria/core/ai/tool-output";

export type GroundedFactDomain = "cash" | "budget" | "stock" | "documents" | "history";
/** Executed read results from this generation only. Never pass conversation history. */
export interface GroundedToolObservation {
  readonly toolName: string;
  readonly toolCallId: string;
  readonly input: unknown;
  readonly output: unknown;
}
export interface GroundedFactSource {
  readonly toolName: string;
  readonly toolCallId: string;
  readonly entityIds: readonly string[];
  readonly query: Readonly<Record<string, unknown>>;
}
export interface GroundedAnswer {
  readonly status: "verified" | "partial" | "waiting" | "error";
  readonly text: string;
  readonly sources: readonly GroundedFactSource[];
  readonly coveredDomains: readonly GroundedFactDomain[];
  readonly missingDomains: readonly GroundedFactDomain[];
  readonly cardNarratives?: readonly CardNarrative[];
}
type Section = { text: string; cardText?: string; source: GroundedFactSource; complete: boolean };
const objectSchema = z.record(z.string(), z.unknown());
const numeric = z.union([z.number().finite(), z.string().regex(/^-?\d+(?:\.\d{1,2})?$/)]);
const money = z.union([numeric, z.object({ amount: numeric })]);
const identity = z.object({ id: z.string().min(1), name: z.string().min(1) });
const stockRow = z.object({
  materialId: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  physical: numeric,
  reserved: numeric,
});
const tools: Readonly<Record<GroundedFactDomain, readonly string[]>> = {
  history: ["getFinancialHistory"],
  cash: ["getBankBalances", "getBankCashContext"],
  budget: ["getProjectBudget", "getProjectHealth"],
  stock: [
    "getWarehouseContext",
    "getStockCorrectionContext",
    "getWarehouseIntakeContext",
    "getProjectStockContext",
    "getMaterials",
  ],
  documents: [
    "getRabWorkflowContext",
    "getRabExportContext",
    "getRapLifecycleContext",
    "getRapSetupContext",
    "getProjectBudget",
    "getUpcomingBills",
    "getVendorBillCorrectionContext",
    "getRecentExpenses",
    "getExpenseBatchContext",
    "listProjects",
  ],
};
const domainLabel: Readonly<Record<GroundedFactDomain, string>> = {
  history: "laporan periode",
  cash: "saldo rekening",
  budget: "budget proyek",
  stock: "stok gudang",
  documents: "status dokumen",
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function plain(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\\`*_{}[\]<>]/g, "")
    .trim();
}
function record(value: unknown): Record<string, unknown> {
  return objectSchema.safeParse(value).data ?? {};
}
function requestedDomains(question: string): GroundedFactDomain[] {
  const text = normalize(question);
  // This renderer deliberately does not rewrite advice, action proposals, or a
  // mixed command. Negated save instructions are safe read-only constraints.
  const intent = normalize(stripQuotedEntitiesForIntent(question)).replace(
    /\b(?:jangan|tanpa)\s+(?:simpan|ubah|bayar|konfirmasi|mutasi|mengubah|menyimpan|gunakan|menggunakan)(?:\s+data)?\b/g,
    "",
  );
  if (
    /\b(?:buat|siapkan|ubah|ganti|koreksi|simpan|bayar|transfer|ajukan|setujui|tolak|hapus|batalkan|reservasi|gunakan|terima|sinkronkan|ekspor|impor|konfirmasi|update|create|save|approve|pay|delete)\b/.test(
      intent,
    )
  )
    return [];
  if (
    /\b(?:bagaimana|gimana|cara|kenapa|mengapa|saran|rekomendasi|sebaiknya|strategi|how|why|should)\b/.test(
      text,
    )
  )
    if (!isExpenseStatusQuestion(question)) return [];
  if (isHistoricalGroundedFactQuestion(question)) return ["history"];
  if (
    /\b(?:kemarin|historis|riwayat|minggu lalu|bulan lalu|tahun lalu|tanggal|forecast|prediksi|perkiraan|dibandingkan)\b/.test(
      text,
    )
  )
    if (!isExpenseStatusQuestion(question)) return [];
  const result: GroundedFactDomain[] = [];
  const cashQuestion = intent.replace(/\b(?:kas (?:dibayar|keluar)|cash paid)\b/g, "");
  if (/\b(?:saldo|kas|balance|cash)\b/.test(cashQuestion)) result.push("cash");
  if (
    /\b(?:budget|anggaran|alokasi|plafon|margin|nilai kontrak|nilai proyek|realisasi|sisa pagu)\b/.test(
      intent,
    ) &&
    !/\b(?:default|pengaturan|settings|standar perusahaan)\b/.test(intent)
  )
    result.push("budget");
  if (/\b(?:stok|stock|inventory)\b/.test(intent)) result.push("stock");
  if (
    (isExpenseStatusQuestion(question) || /\bstatus\b/.test(text)) &&
    /\b(?:rab|rap|tagihan|bill|pengeluaran|expense|proyek|dokumen)\b/.test(text)
  )
    result.push("documents");
  return result;
}
export function isGroundedFactQuestion(question: string): boolean {
  return requestedDomains(question).length > 0;
}
/** A current expense-status clause cannot turn an unsupported past snapshot into a current fact. */
export function isHistoricalGroundedFactQuestion(question: string): boolean {
  if (!isFinancialHistoryQuestion(question)) return false;
  if (!isExpenseStatusQuestion(question)) return true;
  const policy = parseFinancialHistoryRequest(question, new Date());
  return /^(?:Riwayat saldo,|Prediksi belum tersedia\.)/.test(policy.error ?? "");
}
function source(
  observation: GroundedToolObservation,
  entityIds: readonly string[],
): GroundedFactSource {
  return {
    toolName: observation.toolName,
    toolCallId: observation.toolCallId,
    entityIds,
    query: record(observation.input),
  };
}
function amount(value: z.infer<typeof money>): number {
  const parsed = typeof value === "object" ? Number(value.amount) : Number(value);
  const cents = parsed * 100;
  if (!Number.isSafeInteger(Math.round(cents)) || Math.abs(cents - Math.round(cents)) > 0.0001)
    throw new Error("Nominal di luar ketelitian yang didukung.");
  return Math.round(parsed * 100) / 100;
}
function idr(value: z.infer<typeof money>): string {
  const parsed = amount(value);
  return Number.isInteger(parsed) ? formatIdr(parsed) : formatExactIdr(parsed);
}
function quantity(value: z.infer<typeof numeric>): string {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
function sumMoney(values: readonly z.infer<typeof money>[]): number {
  const cents = values.reduce<number>((sum, value) => sum + Math.round(amount(value) * 100), 0);
  if (!Number.isSafeInteger(cents)) throw new Error("Total di luar ketelitian yang didukung.");
  return cents / 100;
}
function binds(question: string, name: string, id: string): boolean {
  if (!name.trim() || !id.trim()) return false;
  if (question.includes(id)) return true;
  const normalizedName = normalize(name);
  if (!normalizedName) return false;
  // Preserve sentence/clause boundaries before normalizing away punctuation.
  // A complete name followed by ". Jangan simpan" is still an explicit target;
  // "QA Lain" remains a different name from "QA".
  const punctuationBoundary = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${normalizedName.split(" ").join("[^\\p{L}\\p{N}]+")}\\s*["'’”»]?\\s*[.,;!?](?:\\s|$)`,
    "iu",
  );
  if (punctuationBoundary.test(question)) return true;
  const text = ` ${normalize(question)} `;
  const token = ` ${normalizedName} `;
  let from = text.indexOf(token);
  while (from >= 0) {
    const tail = text.slice(from + token.length).trim();
    // The following word must be a clause/metric boundary, rather than an
    // unrecognised continuation of a similarly named account/project/location.
    // Pronouns alone are never an identity proof for any returned entity.
    if (
      !tail ||
      /^(?:dan|dengan|untuk|pada|di|saja|terbaru|sekarang|terkini|apakah|berapa|cek|tolong|status|saldo|stok|stock|budget|anggaran|alokasi|realisasi|kas|sisa|plafon|nilai|progres|progress|margin|fisik|reservasi|tersedia|menunggu|yang)\b/.test(
        tail,
      )
    )
      return true;
    from = text.indexOf(token, from + 1);
  }
  return false;
}
function queryBound(question: string, input: Record<string, unknown>): boolean {
  const query = input.query ?? input.materialQuery ?? input.projectQuery;
  return (
    typeof query !== "string" ||
    (query.trim().length > 1 && normalize(question).includes(normalize(query)))
  );
}
function explicitBudgetCategories(question: string, names: readonly string[]): ReadonlySet<string> {
  const text = normalize(question);
  const candidates = names.map(normalize).sort((left, right) => right.length - left.length);
  const selected = new Set<string>();
  for (const marker of text.matchAll(/\b(?:budget|anggaran|kategori|alokasi|realisasi|sisa)\s+/g)) {
    let tail = text
      .slice((marker.index ?? 0) + marker[0].length)
      .replace(/^(?:(?:untuk|di|pada|kategori)\s+)+/, "");
    for (let count = 0; count < candidates.length; count += 1) {
      const category = candidates.find((name) => tail === name || tail.startsWith(`${name} `));
      if (!category) break;
      selected.add(category);
      tail = tail
        .slice(category.length)
        .trim()
        .replace(/^(?:dan|serta)\s+/, "");
    }
  }
  return selected;
}

function cashSection(question: string, observation: GroundedToolObservation): Section | null {
  if (observation.toolName === "getBankBalances") {
    const value = getBankBalancesOutputSchema.safeParse(observation.output).data;
    const metadata = z
      .object({
        accountCount: z.number().int().nonnegative(),
        scope: z.literal("Seluruh rekening aktif perusahaan ini"),
      })
      .safeParse(observation.output).data;
    if (
      !value ||
      !metadata ||
      metadata.accountCount !== value.accounts.length ||
      value.accounts.some((a) => !a.accountId)
    )
      return null;
    const namedAccounts = value.accounts.filter((a) =>
      binds(question, a.accountName, a.accountId ?? ""),
    );
    const normalizedQuestion = ` ${normalize(question)} `;
    const bankOnly = normalize(question)
      .replace(/^(?:cek|berapa|lihat|tampilkan|periksa)\s+/, "")
      .replace(/^(?:saldo|balance)\s+/, "")
      .replace(/^bank\s+/, "")
      .replace(/\s+(?:terbaru|sekarang|saat ini)$/, "");
    const namedBanks = namedAccounts.length
      ? []
      : value.accounts.filter(
          (a) =>
            a.bankName.trim().length > 1 &&
            (normalizedQuestion.includes(` bank ${normalize(a.bankName)} `) ||
              bankOnly === normalize(a.bankName)),
        );
    const explicitlyNamed = namedAccounts.length ? namedAccounts : namedBanks;
    const target = normalize(question).match(/\brekening\s+(.+?)(?:\s+dan\s+|$)/)?.[1];
    const generic =
      !target ||
      /^(?:aktif|perusahaan|gabungan|semua|seluruh|terbaru|terkini|sekarang|saat ini)$/.test(
        target,
      );
    if (!generic && !explicitlyNamed.length) return null;
    if (
      !explicitlyNamed.length &&
      /\b(?:tadi|tersebut|dipilih|ini|itu|barusan|sebelumnya)\b/.test(normalize(question)) &&
      !/\b(?:perusahaan|gabungan|semua rekening|seluruh rekening)\b/.test(normalize(question))
    )
      return null;
    const rows = explicitlyNamed.length ? explicitlyNamed : value.accounts;
    const firstAccount = rows[0];
    const combined = !explicitlyNamed.length;
    // The authoritative total is consumed as provided, never computed from a
    // narrowed search page. Check the all-account invariant before publishing.
    if (amount(value.totalAvailable) !== sumMoney(value.accounts.map((a) => a.balance)))
      return null;
    return {
      text: [
        combined
          ? `Saldo gabungan ${metadata.accountCount} rekening aktif: **${idr(value.totalAvailable)}**.`
          : "Saldo rekening yang diminta:",
        ...rows.map((a) => `- ${plain(a.accountName)} (${plain(a.bankName)}): ${idr(a.balance)}.`),
      ].join("\n"),
      ...(firstAccount
        ? {
            cardText: combined
              ? "Saldo seluruh rekening aktif sudah diperiksa. Rinciannya ada di kartu Saldo rekening."
              : rows.length === 1
                ? `Saldo ${plain(firstAccount.accountName)} (${plain(firstAccount.bankName)}): **${idr(firstAccount.balance)}**.`
                : `Saldo gabungan ${rows.length} rekening ${namedBanks.length ? plain(firstAccount.bankName) : "yang diminta"}: **${idr(sumMoney(rows.map((a) => a.balance)))}**. Rincian tiap rekening ada di kartu Saldo rekening.`,
          }
        : {}),
      source: source(
        observation,
        rows.flatMap((a) => (a.accountId ? [a.accountId] : [])),
      ),
      complete: true,
    };
  }
  const value = z
    .object({
      accounts: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          bankName: z.string(),
          balance: money,
          status: z.string(),
        }),
      ),
      needsDisambiguation: z.boolean(),
      hasMore: z.boolean(),
    })
    .safeParse(observation.output).data;
  const input = record(observation.input);
  if (!value || value.needsDisambiguation || !queryBound(question, input)) return null;
  if (
    typeof input.bankAccountId === "string" &&
    value.accounts.some((a) => a.id !== input.bankAccountId)
  )
    return null;
  if (!value.accounts.length)
    return {
      text: "Rekening sesuai pencarian belum ditemukan.",
      source: source(observation, []),
      complete: true,
    };
  if (!value.accounts.every((a) => binds(question, a.name, a.id))) return null;
  return {
    text: [
      "Saldo rekening sesuai pencarian:",
      ...value.accounts.map(
        (a) => `- ${plain(a.name)}: ${idr(a.balance)} · ${plain(formatBusinessLabel(a.status))}.`,
      ),
      "Hasil pencarian ini bukan saldo gabungan perusahaan.",
      ...(value.hasMore ? ["Masih ada rekening pada halaman berikutnya."] : []),
    ].join("\n"),
    source: source(
      observation,
      value.accounts.map((a) => a.id),
    ),
    complete: !value.hasMore,
  };
}

function budgetSection(
  question: string,
  observation: GroundedToolObservation,
  observations: readonly GroundedToolObservation[],
): Section | null {
  const input = record(observation.input);
  const value = getProjectBudgetOutputSchema.safeParse(observation.output).data;
  if (observation.toolName === "getProjectBudget" && value?.projectId && value.projectName) {
    if (input.projectId !== value.projectId || !binds(question, value.projectName, value.projectId))
      return null;
    const categories = value.categories;
    const raw = record(observation.output);
    const paidCategories = z
      .array(z.object({ categoryCode: z.string(), paid: money }))
      .safeParse(raw.categories).data;
    let categoryQuestion = normalize(question);
    const names = new Set<string>([value.projectName]);
    for (const read of observations) {
      const data = record(read.output);
      for (const name of [data.projectName, record(data.project).name, record(data.location).name])
        if (typeof name === "string" && name.trim()) names.add(name);
      const collections = [
        data.accounts,
        data.inventories,
        data.inventory,
        data.materials,
        record(read.input).resource === "inventory" ? data.items : undefined,
      ];
      for (const collection of collections) {
        const rows = z.array(objectSchema).safeParse(collection).data;
        for (const row of rows ?? []) {
          const name = row.accountName ?? row.materialName ?? row.name;
          if (typeof name === "string" && name.trim()) names.add(name);
        }
      }
    }
    for (const name of [...names].sort((left, right) => right.length - left.length))
      categoryQuestion = categoryQuestion.replaceAll(normalize(name), " ");
    const selectedCategories = explicitBudgetCategories(
      categoryQuestion,
      categories.map((c) => c.categoryName),
    );
    const requested = categories.filter((c) => selectedCategories.has(normalize(c.categoryName)));
    const visible = requested.length ? requested : categories;
    const requestsCategoryDetails =
      requested.length > 0 ||
      /\b(?:semua kategori|seluruh kategori|setiap kategori|masing masing kategori|per kategori|rincian|rinci|detail|lengkap)\b/.test(
        categoryQuestion,
      );
    const summary = [
      `**${plain(value.projectName)}**`,
      `Nilai kontrak ${idr(value.contractValue)} · plafon internal ${idr(value.internalBudget)}.`,
      `Status budget: ${formatBusinessLabel(value.budgetStatus)}.`,
      `Realisasi tercatat ${idr(sumMoney(categories.map((c) => c.actual)))} · sisa alokasi kategori ${idr(sumMoney(categories.map((c) => c.remaining)))}.`,
    ];
    const categoryLine = (c: (typeof categories)[number]): string => {
      const categoryPaid = paidCategories?.find((p) => p.categoryCode === c.categoryCode);
      return `- ${plain(c.categoryName)}: alokasi ${idr(c.allocated)}; realisasi ${idr(c.actual)}; ${categoryPaid ? `kas dibayar ${idr(categoryPaid.paid)}; ` : ""}menunggu review ${idr(c.pending)}; sisa ${idr(c.remaining)} · ${quantity(c.usedPercentage)}% · ${formatBusinessLabel(c.status)}.`;
    };
    const shownCategoryCodes = new Set(
      selectVisibleBudgetCategories(categories).shown.map((c) => c.categoryCode),
    );
    const lines = [...summary, ...visible.map(categoryLine)];
    const cardLines = [
      ...summary,
      ...(requestsCategoryDetails ? visible : []).map((c): string => {
        // The card omits payment and pending-review facts; keep those visible.
        // Hidden rows still need their complete factual answer in the bubble.
        if (!shownCategoryCodes.has(c.categoryCode)) return categoryLine(c);
        const categoryPaid = paidCategories?.find((p) => p.categoryCode === c.categoryCode);
        return `- ${plain(c.categoryName)}: ${categoryPaid ? `kas dibayar ${idr(categoryPaid.paid)}; ` : ""}menunggu review ${idr(c.pending)}.`;
      }),
    ];
    const cardOnlySummary = requestsCategoryDetails
      ? []
      : [`Menunggu review: ${idr(sumMoney(categories.map((c) => c.pending)))}.`];
    const qualifications: string[] = [];
    const paid = paidCategories
      ? sumMoney(paidCategories.map((c) => c.paid))
      : money.safeParse(raw.paidAmount).data;
    const needsPaid = /\b(?:dibayar|dibayarkan|paid|kas keluar|sudah keluar)\b/.test(
      normalize(question),
    );
    if (paid !== undefined) qualifications.push(`Kas dibayar: ${idr(paid)}.`);
    else if (needsPaid)
      qualifications.push(
        "Kas yang sudah dibayar belum terverifikasi dari pembacaan ini; realisasi budget berbeda dari kas dibayar.",
      );
    if (/\bsisa (?:budget|anggaran|plafon)(?: total| proyek)?\b/.test(normalize(question)))
      qualifications.push(
        `Sisa plafon internal terhadap realisasi tercatat: ${idr(sumMoney([value.internalBudget, -sumMoney(categories.map((c) => c.actual))]))}. Sisa alokasi kategori hanya mencakup budget yang telah dialokasikan.`,
      );
    const wantsMargin = /\bmargin\b/.test(normalize(question));
    if (wantsMargin)
      qualifications.push(
        `Selisih nilai kontrak terhadap realisasi tercatat: ${idr(sumMoney([value.contractValue, -sumMoney(categories.map((c) => c.actual))]))}. Ini belum merupakan margin akhir proyek.`,
      );
    const wantsRab = /\b(?:rab disetujui|approved rab|nilai rab)\b/.test(normalize(question));
    const rab = money.safeParse(raw.approvedRabValue).data;
    if (wantsRab)
      qualifications.push(
        rab === undefined
          ? "Nilai RAB disetujui belum terverifikasi dari pembacaan ini."
          : `Nilai RAB disetujui: ${idr(rab)}.`,
      );
    if (/\b(?:progres|progress)\b/.test(normalize(question)))
      qualifications.push(`Progres proyek: ${quantity(value.projectProgressPercentage)}%.`);
    return {
      text: [...lines, ...qualifications].join("\n"),
      ...(categories.length > 0
        ? { cardText: [...cardLines, ...cardOnlySummary, ...qualifications].join("\n") }
        : {}),
      source: source(observation, [value.projectId]),
      complete:
        (!needsPaid || paid !== undefined) && !wantsMargin && (!wantsRab || rab !== undefined),
    };
  }
  if (observation.toolName !== "getProjectHealth") return null;
  const health = getProjectHealthOutputSchema.safeParse(observation.output).data;
  if (
    !health?.projectId ||
    input.projectId !== health.projectId ||
    !binds(question, health.projectName, health.projectId)
  )
    return null;
  return {
    text: [
      `${plain(health.projectName)}: ${formatBusinessLabel(health.health)}.`,
      ...(health.totalAllocated ? [`Alokasi kategori ${idr(health.totalAllocated)}.`] : []),
      ...(health.totalActual ? [`Realisasi tercatat ${idr(health.totalActual)}.`] : []),
      ...(health.totalRemaining ? [`Sisa alokasi kategori ${idr(health.totalRemaining)}.`] : []),
      ...health.reasons.map(plain),
      ...(health.note ? [plain(health.note)] : []),
    ].join("\n"),
    source: source(observation, [health.projectId]),
    complete: false,
  };
}

function stockSection(
  question: string,
  observation: GroundedToolObservation,
  observations: readonly GroundedToolObservation[],
): Section | null {
  const input = record(observation.input),
    output = record(observation.output);
  let location = identity.safeParse(output.location).data;
  let rows: z.infer<typeof stockRow>[] | undefined;
  let hasMore = output.hasMore === true;
  if (observation.toolName === "getWarehouseContext")
    rows = z.array(stockRow).safeParse(output.inventory).data;
  if (
    observation.toolName === "getStockCorrectionContext" ||
    observation.toolName === "getWarehouseIntakeContext"
  ) {
    if (input.resource !== "inventory" || typeof input.inventoryLocationId !== "string")
      return null;
    if (!location) {
      for (const item of observations) {
        const candidates =
          record(item.output).locations ??
          (record(item.input).resource === "locations" ? record(item.output).items : undefined);
        const choices = z
          .array(
            z.object({
              id: z.string().optional(),
              locationId: z.string().optional(),
              name: z.string(),
            }),
          )
          .safeParse(candidates).data;
        const choice = choices?.find((c) => (c.id ?? c.locationId) === input.inventoryLocationId);
        if (choice) location = { id: input.inventoryLocationId, name: choice.name };
      }
    }
    const inventory = z
      .array(
        z.object({
          materialId: z.string().min(1),
          name: z.string().min(1),
          unit: z.string().min(1),
          currentStock: numeric,
          reservedStock: numeric,
        }),
      )
      .safeParse(output.items).data;
    rows = inventory?.map((r) => ({
      materialId: r.materialId,
      name: r.name,
      unit: r.unit,
      physical: r.currentStock,
      reserved: r.reservedStock,
    }));
  }
  if (observation.toolName === "getProjectStockContext") {
    const project = identity.safeParse(output.project).data;
    if (!project || input.projectId !== project.id || !binds(question, project.name, project.id))
      return null;
    const inventory = z
      .array(
        z.object({
          materialId: z.string(),
          materialName: z.string(),
          unit: z.string(),
          inventoryLocationId: z.string(),
          locationName: z.string(),
          current: numeric,
          reserved: numeric,
        }),
      )
      .safeParse(output.inventories).data;
    if (!inventory?.length) return null;
    // A project read covers several warehouses; never call their sum the stock
    // of one named warehouse. Publish each location separately instead.
    const visible = inventory.filter(
      (r) =>
        binds(question, r.materialName, r.materialId) &&
        binds(question, r.locationName, r.inventoryLocationId),
    );
    if (!visible.length) return null;
    const locations = [...new Set(visible.map((r) => r.inventoryLocationId))];
    hasMore = output.inventoriesHasMore === true;
    return {
      text: [
        `Stok gudang untuk ${plain(project.name)}:`,
        ...visible.map(
          (r) =>
            `- ${plain(r.materialName)} · ${plain(r.locationName)}: fisik ${quantity(r.current)}, reservasi ${quantity(r.reserved)}, tersedia ${quantity(Number(r.current) - Number(r.reserved))} ${plain(r.unit)}.`,
        ),
        ...(hasMore ? ["Ini sebagian hasil; masih ada stok pada halaman berikutnya."] : []),
      ].join("\n"),
      source: source(observation, [project.id, ...locations, ...visible.map((r) => r.materialId)]),
      complete: !hasMore,
    };
  }
  if (
    !location ||
    !rows ||
    input.inventoryLocationId !== location.id ||
    !binds(question, location.name, location.id) ||
    !queryBound(question, input)
  )
    return null;
  const queried = typeof (input.query ?? input.materialQuery) === "string";
  if (queried && rows.length !== 1 && !/\b(?:semua|seluruh|daftar)\b/.test(normalize(question)))
    return null;
  if (!rows.every((r) => binds(question, r.name, r.materialId) || !queried)) return null;
  return {
    text: [
      `**${plain(location.name)}**`,
      ...rows.map(
        (r) =>
          `- ${plain(r.name)}: fisik ${quantity(r.physical)}, reservasi ${quantity(r.reserved)}, tersedia ${quantity(Number(r.physical) - Number(r.reserved))} ${plain(r.unit)}.`,
      ),
      ...(!rows.length ? ["Material sesuai pencarian belum ditemukan."] : []),
      ...(hasMore ? ["Ini sebagian hasil; masih ada stok pada halaman berikutnya."] : []),
    ].join("\n"),
    source: source(observation, [location.id, ...rows.map((r) => r.materialId)]),
    complete: !hasMore,
  };
}

function documentSection(question: string, observation: GroundedToolObservation): Section | null {
  if (
    isExpenseStatusQuestion(question) &&
    ["getRecentExpenses", "getExpenseBatchContext"].includes(observation.toolName)
  )
    return renderGroundedExpenseSection(question, observation, binds);
  const output = record(observation.output),
    input = record(observation.input);
  if (observation.toolName === "getVendorBillCorrectionContext") {
    const bill = z
      .object({
        id: z.string(),
        billNumber: z.string(),
        projectId: z.string(),
        project: z.string(),
        status: z.string(),
      })
      .safeParse(output.bill).data;
    if (!bill || input.vendorBillId !== bill.id || !binds(question, bill.billNumber, bill.id))
      return null;
    return {
      text: `Tagihan ${plain(bill.billNumber)} · ${plain(bill.project)}: ${formatBusinessLabel(bill.status)}.`,
      source: source(observation, [bill.projectId, bill.id]),
      complete: true,
    };
  }
  if (observation.toolName === "listProjects") {
    const value = z
      .array(z.object({ projectId: z.string(), name: z.string(), status: z.string() }))
      .safeParse(output.projects).data;
    if (
      !value ||
      !value.every((p) => binds(question, p.name, p.projectId)) ||
      !queryBound(question, input)
    )
      return null;
    return {
      text: value.map((p) => `${plain(p.name)}: ${formatBusinessLabel(p.status)}.`).join("\n"),
      source: source(
        observation,
        value.map((p) => p.projectId),
      ),
      complete: value.length > 0,
    };
  }
  const project = identity.safeParse(output.project).data;
  const projectId = project?.id ?? z.string().safeParse(output.projectId).data;
  const projectName = project?.name ?? z.string().safeParse(output.projectName).data;
  if (
    !projectId ||
    !projectName ||
    input.projectId !== projectId ||
    !binds(question, projectName, projectId)
  )
    return null;
  if (observation.toolName === "getProjectBudget") {
    if (
      /\b(?:rap|rab|tagihan|bill|dokumen|pengeluaran|expense)\b/.test(normalize(question)) &&
      !/\bstatus proyek\b/.test(normalize(question))
    )
      return null;
    const status = z.string().min(1).safeParse(output.projectStatus).data;
    return status
      ? {
          text: `Status ${plain(projectName)}: ${formatBusinessLabel(status)}.`,
          source: source(observation, [projectId]),
          complete: true,
        }
      : null;
  }
  if (observation.toolName === "getRapSetupContext") {
    const state = z
      .object({
        projectRapId: z.string().min(1),
        status: z.string().min(1),
        stage: z.enum(["MATERIAL", "TUKANG", "SUBCON", "REVIEW", "COMPLETE"]),
      })
      .safeParse(output).data;
    if (!state) return null;
    const stage = state.stage === "COMPLETE" ? "Selesai" : formatBusinessLabel(state.stage);
    return {
      text: `Status RAP · ${plain(projectName)}:\n- RAP: ${formatBusinessLabel(state.status)} · tahap ${stage}.`,
      source: source(observation, [projectId, state.projectRapId]),
      complete: true,
    };
  }
  const schema = z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    status: z.string().min(1),
    revision: z.number().int().nonnegative(),
  });
  const kind = observation.toolName.startsWith("getRab")
    ? "RAB"
    : observation.toolName.startsWith("getRap")
      ? "RAP"
      : undefined;
  if (!kind) return null;
  const selectedId = typeof input.rabEstimateId === "string" ? input.rabEstimateId : undefined;
  const records =
    kind === "RAP" ? [output.rap] : selectedId ? [output.rab] : (output.rabs ?? output.revisions);
  const parsed = z.array(schema).safeParse(records).data;
  if (!parsed || (selectedId && parsed.some((r) => r.id !== selectedId))) return null;
  // RAP's header is a complete latest baseline; lifecycle.hasMore only pages
  // work packages. RAB revision pagination does affect the status list.
  const hasMore = kind === "RAB" && (output.hasMore === true || output.rabsHasMore === true);
  return {
    text: [
      `Status ${kind} · ${plain(projectName)}:`,
      ...parsed.map(
        (r) =>
          `- ${plain(r.title ?? kind)} · revisi ${r.revision}: ${formatBusinessLabel(r.status)}.`,
      ),
      ...(!parsed.length ? [`Belum ada ${kind} tersimpan.`] : []),
      ...(hasMore ? ["Ini sebagian revisi; masih ada hasil pada halaman berikutnya."] : []),
    ].join("\n"),
    source: source(observation, [projectId, ...parsed.map((r) => r.id)]),
    complete: !hasMore,
  };
}

/** A factual answer is generated from the successful current-run reads, never
 * from model prose or historical tool parts. This function cannot authorize reads. */
export function renderGroundedFacts(
  question: string,
  currentRun: readonly GroundedToolObservation[],
  availableTools?: readonly string[],
): GroundedAnswer | null {
  const requested = requestedDomains(question);
  if (!requested.length) return null;
  if (requested.includes("history"))
    return renderGroundedHistory(question, currentRun, availableTools);
  const sections: Section[] = [],
    covered: GroundedFactDomain[] = [],
    missing: GroundedFactDomain[] = [],
    issues: string[] = [];
  const sectionIndexes = new Map<string, number>();
  for (const domain of requested) {
    if (availableTools && !tools[domain].some((name) => availableTools.includes(name))) {
      missing.push(domain);
      issues.push(
        `Akses pembacaan ${domainLabel[domain]} lewat AI tidak tersedia untuk izin Anda saat ini.`,
      );
      continue;
    }
    const supporting =
      domain === "stock"
        ? ["listProjects", "getInventoryLocations"]
        : domain === "budget"
          ? ["listProjects"]
          : [];
    const relevant = currentRun.filter(
      (o) => tools[domain].includes(o.toolName) || supporting.includes(o.toolName),
    );
    // The latest attempt for exactly the same read replaces an earlier failed
    // retry. Errors for a different target remain visible.
    const inputKey = (input: unknown): string =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(record(input)).sort(([left], [right]) => left.localeCompare(right)),
        ),
      );
    const latest = relevant.filter(
      (o, i) =>
        !relevant
          .slice(i + 1)
          .some(
            (next) => next.toolName === o.toolName && inputKey(next.input) === inputKey(o.input),
          ),
    );
    const ambiguous = latest.some((o) => {
      const value = record(o.output);
      if (
        !(domain === "budget" || domain === "documents" || domain === "stock") ||
        !(
          value.requiresProjectChoice === true ||
          (value.needsDisambiguation === true && Array.isArray(value.projects))
        )
      )
        return false;
      const candidates = z
        .array(
          z.object({
            id: z.string().optional(),
            projectId: z.string().optional(),
            name: z.string(),
          }),
        )
        .safeParse(value.projects).data;
      const bound = candidates?.filter((candidate) =>
        binds(question, candidate.name, candidate.id ?? candidate.projectId ?? ""),
      );
      if (!bound || bound.length !== 1) return true;
      const selectedId = bound[0]?.id ?? bound[0]?.projectId;
      // A broad search can be followed by a human-named choice, but the scoped
      // result must actually reread that exact candidate after the discovery.
      const afterDiscovery = currentRun.slice(currentRun.indexOf(o) + 1);
      return (
        !selectedId ||
        !afterDiscovery.some((read) => {
          const result = record(read.output),
            input = record(read.input);
          const actual = identity.safeParse(result.project).data;
          const actualId = actual?.id ?? z.string().safeParse(result.projectId).data;
          const actualName = actual?.name ?? z.string().safeParse(result.projectName).data;
          return (
            tools[domain].includes(read.toolName) &&
            !result.error &&
            input.projectId === selectedId &&
            actualId === selectedId &&
            Boolean(actualName && binds(question, actualName, actualId))
          );
        })
      );
    });
    if (ambiguous) {
      missing.push(domain);
      issues.push(`Pilih proyek yang dimaksud sebelum ${domainLabel[domain]} ditampilkan.`);
      continue;
    }
    let complete = false;
    for (const observation of latest) {
      const failure = z.object({ error: z.string().min(1) }).safeParse(observation.output).data;
      if (failure) {
        issues.push(`${domainLabel[domain]} belum dapat diverifikasi: ${plain(failure.error)}`);
        continue;
      }
      try {
        const section =
          domain === "cash"
            ? cashSection(question, observation)
            : domain === "budget"
              ? budgetSection(question, observation, currentRun)
              : domain === "stock"
                ? stockSection(question, observation, currentRun)
                : documentSection(question, observation);
        if (section) {
          const key = `${domain}:${[...section.source.entityIds].sort().join(",")}`;
          const index = sectionIndexes.get(key);
          const previous = index === undefined ? undefined : sections[index];
          if (index === undefined) {
            sectionIndexes.set(key, sections.length);
            sections.push(section);
          } else if (section.complete || !previous?.complete) sections[index] = section;
          complete ||= section.complete;
        }
      } catch {
        issues.push(`${domainLabel[domain]} belum dapat diverifikasi karena nominal tidak valid.`);
      }
    }
    if (domain === "documents") {
      const text = normalize(question);
      const sources = sections.map((s) => s.source.toolName);
      if (/\brab\b/.test(text) && !sources.some((name) => name.startsWith("getRab")))
        complete = false;
      if (/\brap\b/.test(text) && !sources.some((name) => name.startsWith("getRap")))
        complete = false;
      if (/\b(?:tagihan|bill)\b/.test(text) && !sources.includes("getVendorBillCorrectionContext"))
        complete = false;
      if (/\b(?:pengeluaran|expense)\b/.test(text))
        complete &&= sections.some(
          (section) =>
            section.complete &&
            ["getRecentExpenses", "getExpenseBatchContext"].includes(section.source.toolName),
        );
    }
    if (complete) covered.push(domain);
    else {
      missing.push(domain);
      if (!issues.some((line) => line.includes(domainLabel[domain])))
        issues.push(
          `${domainLabel[domain]} belum terverifikasi lengkap. Perlu pembacaan baru atau pilihan data yang tepat.`,
        );
    }
  }
  const errors = issues.length > 0;
  const cardNarratives: CardNarrative[] = sections.flatMap((section): CardNarrative[] => {
    const toolName = section.source.toolName;
    if (!section.cardText || (toolName !== "getBankBalances" && toolName !== "getProjectBudget"))
      return [];
    return [
      {
        toolName,
        toolCallId: section.source.toolCallId,
        fullText: section.text,
        cardText: section.cardText,
      },
    ];
  });
  return {
    status:
      missing.length === 0 && !errors
        ? "verified"
        : sections.length > 0
          ? "partial"
          : issues.some(
                (i) => i.includes("belum dapat diverifikasi") || i.startsWith("Akses pembacaan"),
              )
            ? "error"
            : "waiting",
    text: ["Data dari pembacaan terbaru:", ...sections.map((s) => s.text), ...issues].join("\n\n"),
    sources: sections.map((s) => s.source),
    coveredDomains: covered,
    missingDomains: missing,
    ...(cardNarratives.length > 0 ? { cardNarratives } : {}),
  };
}
