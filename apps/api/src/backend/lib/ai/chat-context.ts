import type { UIMessage } from "ai";
import type { ChatProviderName } from "./providers";
import { AI_CAPABILITIES } from "./tools/capability-catalog";
import { isFinancialHistoryQuestion } from "@atria/core/ai/financial-history";

const SUPPORT = [
  "getAvailableActions",
  "requestUserInput",
  "suggestFollowUps",
  "explainUserAccess",
];
const FAMILIES: readonly { readonly pattern: RegExp; readonly tools: readonly string[] }[] = [
  {
    pattern:
      /\b(historis|riwayat|bandingkan|perbandingan|dibandingkan|periode|bulan|kemarin|hari ini|arus kas|cash flow)\b/i,
    tools: ["getFinancialHistory", "listProjects", "getBankCashContext", "getRecentExpenses"],
  },
  {
    pattern: /\b(proyek|project|alokasi|realisasi|profitabilitas|anggaran proyek)\b/i,
    tools: [
      "listProjects",
      "getProjectsAtRisk",
      "getProjectBudget",
      "getProjectHealth",
      "getProjectManagementContext",
      "proposeProjectManagement",
      "proposeCreateProject",
      "proposeSetupProjectBudget",
      "inspectProjectBudgetSummary",
    ],
  },
  {
    pattern: /\b(rekening|saldo|bank|kas|cash|transfer)\b/i,
    tools: ["getBankCashContext", "getBankBalances", "proposeBankCash"],
  },
  {
    pattern:
      /\b(rekonsiliasi|reconciliation|mutasi|rekening koran|statement|cocokkan|pencocokan)\b/i,
    tools: [
      "getBankReconciliationContext",
      "analyzeBankStatementAttachment",
      "proposeBankReconciliation",
    ],
  },
  {
    pattern: /\b(pengeluaran|expense|biaya operasional|reimbursement|persetujuan|approval)\b/i,
    tools: [
      "getRecentExpenses",
      "getExpenseCategories",
      "getPendingApprovals",
      "getPendingExpenseApprovals",
      "getExpenseBatchContext",
      "proposeExpenseBatch",
      "proposeExpenseBatchVerify",
      "proposeExpenseBatchDecision",
      "proposeExpenseBatchPayment",
      "proposeExpenseDraft",
      "proposeExpenseReview",
      "proposeDisburseExpense",
    ],
  },
  {
    pattern: /\b(vendor|supplier|pemasok|tagihan|invoice|utang|hutang|bill)\b/i,
    tools: [
      "listVendors",
      "getUpcomingBills",
      "getUnpaidVendorBills",
      "getVendorPaymentContext",
      "proposeVendorPaymentSchedule",
      "proposeVendorPaymentDecision",
      "proposeVendorBillPayment",
      "getVendorBillContext",
      "proposeVendorBill",
      "getVendorBillCorrectionContext",
      "proposeVendorBillCorrection",
    ],
  },
  {
    pattern: /\b(klien|client|pelanggan|termin|piutang)\b/i,
    tools: [
      "listClients",
      "getClientInvoiceContext",
      "getUnpaidClientInvoices",
      "proposeClientInvoice",
      "proposeClientInvoiceSchedule",
      "proposeRecordClientPayment",
    ],
  },
  {
    pattern:
      /\b(material|stok|stock|gudang|inventory|panel|penerimaan|opname|reservasi|pemakaian|retur|waste)\b/i,
    tools: [
      "getMaterialCatalog",
      "getInventoryLocations",
      "getMaterialShortage",
      "getMaterialInputContext",
      "getEditableMaterials",
      "getMaterialDraftForCorrection",
      "proposeMaterialMaster",
      "proposeUpdateMaterial",
      "getProjectStockContext",
      "proposeProjectStock",
      "getWarehouseContext",
      "proposeWarehouseOperation",
      "getWarehouseIntakeContext",
      "proposeWarehouseIntake",
      "proposeGoodsReceipt",
      "getStockCorrectionContext",
      "proposeStockCorrection",
    ],
  },
  {
    pattern: /\b(rap|tukang|subcon|rencana pelaksanaan|rencana material)\b/i,
    tools: [
      "getRapDraftContext",
      "proposeRapMaterialDraft",
      "getEditableRapItems",
      "proposeRapMaterialChanges",
      "getCategoryPlanContext",
      "proposeCategoryPlanPackages",
      "getRapSetupContext",
      "proposeRapSetupActions",
      "getRapLifecycleContext",
      "proposeRapLifecycleActions",
    ],
  },
  {
    pattern: /\b(rab|penawaran|quotation|change order|ekspor|export)\b/i,
    tools: [
      "getRabDraftContext",
      "proposeRabDraft",
      "getRabWorkflowContext",
      "proposeRabWorkflow",
      "getRabExportContext",
      "prepareRabExport",
    ],
  },
  {
    pattern:
      /\b(setting|settings|pengaturan|default|plafon|margin|rasio|persentase|library|katalog|harga standar|template)\b/i,
    tools: [
      "getCompanyBudgetDefaults",
      "getBudgetSettingsContext",
      "proposeBudgetSettings",
      "getOperationalSettingsContext",
      "getExpenseCategorySettingsContext",
      "proposeApprovalThresholds",
      "proposeExpenseCategorySettings",
      "getCatalogSettingsContext",
      "proposeCatalogSettings",
    ],
  },
  {
    pattern:
      /\b(staf|staff|role|peran|izin|permission|akses|pengguna|karyawan|user|pm|project manager)\b/i,
    tools: [
      "getAdministrationContext",
      "proposeStaffChanges",
      "proposeRoleDetails",
      "proposeRoleDeletion",
      "whoCanDo",
      "analyzeRoleChangeImpact",
      "proposeRoleChange",
      "listRoles",
      "proposeCreateUser",
      "proposeCreateUserBatch",
      "proposeCreateRole",
      "suggestRoleReview",
    ],
  },
  {
    pattern: /\b(profil|profile|avatar|foto|nama saya|nama sendiri)\b/i,
    tools: ["getOwnProfileContext", "proposeOwnProfile"],
  },
  {
    pattern: /\b(quick start|quickstart|onboarding|setup awal|mulai erp)\b/i,
    tools: ["getQuickStartContext", "proposeQuickStart"],
  },
];

function textOf(message: UIMessage | undefined): string {
  return (
    message?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n") ?? ""
  );
}

export function generationMessages(
  messages: readonly UIMessage[],
  provider: ChatProviderName = "NINEROUTER",
): UIMessage[] {
  // Native providers may require their original reasoning/signature sequence.
  if (provider !== "NINEROUTER") return [...messages];
  return messages.map((message) =>
    message.role !== "assistant"
      ? message
      : {
          ...message,
          parts: message.parts.filter(
            (part) =>
              part.type !== "step-start" &&
              (part.type !== "reasoning" || part.providerMetadata !== undefined),
          ),
        },
  );
}

export function initialActiveTools(
  messages: readonly UIMessage[],
  available: readonly string[],
): string[] {
  const userIndex = messages.findLastIndex((message) => message.role === "user"),
    latest = messages[userIndex],
    text = textOf(latest);
  let families = FAMILIES.filter((family) => family.pattern.test(text));
  const reference = /\b(tadi|itu|tersebut|barusan|sebelumnya|lanjut|yang sama)\b/i.test(text);
  if (reference) {
    const previous = messages
      .slice(0, userIndex)
      .findLast((message) => message.role === "assistant");
    const names =
      previous?.parts.flatMap((part) =>
        part.type === "dynamic-tool"
          ? [part.toolName]
          : part.type.startsWith("tool-")
            ? [part.type.slice(5)]
            : [],
      ) ?? [];
    families = [
      ...new Set([
        ...families,
        ...FAMILIES.filter((family) => family.tools.some((name) => names.includes(name))),
      ]),
    ];
  }
  // An unrecognized task retains the full authorized catalog rather than guessing.
  if (!families.length) return [...available];
  const intent = text.replace(/\bjangan\b[^.!?\n]*/gi, "");
  const readOnly =
    /^\s*(?:(?:tolong|coba|please)\s+)?(?:berapa|siapa|cek|periksa|lihat|tampilkan|bandingkan|jelaskan|apa|bagaimana|ambil data|ringkas)\b/i.test(
      intent,
    ) &&
    !/\b(siapkan|buat|catat|ubah|koreksi|hapus|bayar|ajukan|setujui|tolak|terapkan|impor|import|aktifkan|nonaktifkan|transfer|finalisasi|kunci|revisi|edit|update|create|approve|reject|submit|record|pay|usulan|draft|draf|ekspor|export)\b/i.test(
      intent,
    );
  const known = new Set(FAMILIES.flatMap((family) => family.tools));
  const selected = new Set([
    ...SUPPORT,
    ...families
      .flatMap((family) => family.tools)
      .filter((name) => !readOnly || AI_CAPABILITIES[name]?.mode !== "proposal"),
    ...available.filter((name) => !known.has(name)),
  ]);
  for (const name of selected)
    for (const dependency of AI_CAPABILITIES[name]?.dependencies ?? [])
      if (available.includes(dependency)) selected.add(dependency);
  // Order and effective access come from the original permission-filtered registry.
  return available.filter((name) => selected.has(name));
}

export function stepActiveTools(
  initial: readonly string[],
  available: readonly string[],
  called: readonly string[],
): string[] {
  return called.includes("getAvailableActions") ? [...available] : [...initial];
}

/** Fresh reads retain their relevant peers; proposals remain deferred until facts are ready. */
export function freshReadActiveTools(
  selected: readonly string[],
  available: readonly string[],
): string[] {
  const reads = new Set([
    ...selected.filter((name) => AI_CAPABILITIES[name]?.mode === "read"),
    "getAvailableActions",
  ]);
  return available.filter((name) => reads.has(name));
}

export function successfulReadOutput(output: unknown): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    !("error" in output) &&
    !("success" in output && output.success === false)
  );
}

/** Own-profile requests always start from the actual row, never an old preview. */
export function requiredFreshRead(
  messages: readonly UIMessage[],
  active: readonly string[],
): string | undefined {
  const text = textOf(messages.findLast((message) => message.role === "user"));
  return active.includes("getOwnProfileContext") &&
    /\b(profil(?: aktual| terbaru)? saya|profile saya|nama(?: profil)? saya|foto(?: profil)? saya|avatar saya)\b/i.test(
      text,
    )
    ? "getOwnProfileContext"
    : undefined;
}

export function requiredFreshReads(
  messages: readonly UIMessage[],
  active: readonly string[],
): string[] {
  const text = textOf(messages.findLast((message) => message.role === "user"));
  if (isFinancialHistoryQuestion(text))
    return active.includes("getFinancialHistory") ? ["getFinancialHistory"] : [];
  const profile = requiredFreshRead(messages, active);
  return [
    ...(profile ? [profile] : []),
    ...(/\b(saldo|kas tersedia)\b/i.test(text) && active.includes("getBankBalances")
      ? ["getBankBalances"]
      : []),
    ...(/\b(stok|stock)\b/i.test(text) &&
    /\b(fisik|tercadang|tersedia|aktual|terbaru)\b/i.test(text) &&
    active.includes("getInventoryLocations")
      ? ["getInventoryLocations"]
      : []),
  ];
}
