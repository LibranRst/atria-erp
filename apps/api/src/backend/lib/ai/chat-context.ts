import { getToolName, isToolUIPart, type UIMessage } from "ai";
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

const RECENT_GENERATION_USER_TURNS = 4;

function historicalReadCanBeRemoved(part: UIMessage["parts"][number]): boolean {
  if (!isToolUIPart(part) || part.state !== "output-available") return false;
  const name = getToolName(part);
  if (name === "requestUserInput" || AI_CAPABILITIES[name]?.mode !== "read") return false;
  if (
    part.approval ||
    part.providerExecuted ||
    part.callProviderMetadata !== undefined ||
    part.resultProviderMetadata !== undefined
  )
    return false;
  const output = part.output;
  if (!successfulReadOutput(output) || typeof output !== "object" || output === null) return false;
  // A read may also return an interactive artifact or a server-owned receipt.
  // Retain its complete input/output rather than infer that the workflow ended.
  return !(
    "proposal" in output ||
    "confirmation" in output ||
    "isConfirmedByUser" in output ||
    ("status" in output && output.status === "INPUT_REQUESTED") ||
    ("toolFailed" in output && output.toolFailed === true)
  );
}

function messageHasProviderMetadata(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      ("providerMetadata" in part && part.providerMetadata !== undefined) ||
      (isToolUIPart(part) &&
        (("callProviderMetadata" in part && part.callProviderMetadata !== undefined) ||
          ("resultProviderMetadata" in part && part.resultProviderMetadata !== undefined))),
  );
}

function recentGenerationStart(messages: readonly UIMessage[]): number {
  let turns = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user" && ++turns === RECENT_GENERATION_USER_TURNS) return index;
  }
  return 0;
}

export function expectedSingleFamilyProposalTools(
  question: string,
  available: readonly string[],
): string[] {
  const intent = question.replace(/\bjangan\b[^.!?\n]*/gi, "");
  const families = FAMILIES.filter((family) => family.pattern.test(intent));
  if (families.length !== 1) return [];
  const expected = new Set(families.flatMap((family) => family.tools));
  return available.filter(
    (name) =>
      expected.has(name) &&
      AI_CAPABILITIES[name]?.mode === "proposal" &&
      name !== "proposeMaterialMaster",
  );
}

export function generationMessages(
  messages: readonly UIMessage[],
  provider: ChatProviderName = "NINEROUTER",
): UIMessage[] {
  // Native providers may require their original reasoning/signature sequence.
  if (provider !== "NINEROUTER") return [...messages];
  const latestText = textOf(messages.findLast((message) => message.role === "user"));
  // Ordered/older references can depend on list results outside the recent window.
  // Fall back to the complete tool history rather than guess the selected entity.
  const refersToOlderResults =
    /\b(pertama|paling awal|awal percakapan|daftar sebelumnya|daftar tadi|hasil sebelumnya|riwayat tadi|first|earlier list|at the beginning)\b/i.test(
      latestText,
    );
  const recentStart = refersToOlderResults ? 0 : recentGenerationStart(messages);
  const metadataBoundMessages = new Set(messages.filter(messageHasProviderMetadata));
  const protectedCalls = new Set<string>();
  for (const [index, message] of messages.entries())
    for (const part of message.parts)
      if (
        isToolUIPart(part) &&
        (index >= recentStart ||
          message.role !== "assistant" ||
          metadataBoundMessages.has(message) ||
          !historicalReadCanBeRemoved(part))
      )
        protectedCalls.add(part.toolCallId);
  return messages
    .map((message, index) =>
      message.role !== "assistant"
        ? message
        : {
            ...message,
            parts: message.parts.filter(
              (part) =>
                part.type !== "step-start" &&
                (part.type !== "reasoning" || part.providerMetadata !== undefined) &&
                (index >= recentStart ||
                  metadataBoundMessages.has(message) ||
                  !historicalReadCanBeRemoved(part) ||
                  (isToolUIPart(part) && protectedCalls.has(part.toolCallId))),
            ),
          },
    )
    .filter((message) => message.role !== "assistant" || message.parts.length > 0);
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
    /^\s*(?:(?:tolong|coba|please)\s+)?(?:berapa|siapa|cek|periksa|lihat|tampilkan|bandingkan|jelaskan|apa|bagaimana|ambil data|ringkas|baca|sebutkan)\b/i.test(
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
