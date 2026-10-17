import { expect, mock } from "bun:test";
import { simulateReadableStream, tool, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { z } from "zod";
import {
  parseFinancialHistoryRequest,
  type FinancialHistoryOutput,
} from "@atria/core/ai/financial-history";

const mode = process.argv[2];
const accountId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const expenseId = "00000000-0000-4000-8000-000000000003";
let proposalsExecuted = 0;
let historyReads = 0;
let unrelatedReads = 0;
let bankReads = 0;
let readQuestion = "";
let asOf = "";
const sent: LanguageModelV4CallOptions[] = [];
const statusQuestion = "Cek status pengeluaran Biaya panel QA di Proyek QA sekarang.";
const historyQuestion = "Bandingkan pengeluaran Proyek QA Oktober 2026 dengan September 2026.";
const mixedHistoryQuestion =
  "Bandingkan pengeluaran dan arus kas perusahaan Oktober 2026 dengan September 2026.";
const question =
  mode === "project-count-current"
    ? "Cek jumlah seluruh proyek, termasuk draf, dan saldo total rekening yang tercatat saat ini. Hanya baca data; jangan membuat atau mengubah apa pun."
    : mode === "expense-status"
      ? statusQuestion
      : mode === "stock-cost-comparison"
        ? "Uji AI v1 final: bandingkan pengeluaran Proyek Operasional QA bulan Oktober 2026 dengan September 2026. Pisahkan biaya pemakaian stok dari pembelian persediaan; jangan simpan perubahan."
        : mode === "mixed-current"
          ? "Cek saldo Rekening QA dan status pengeluaran Biaya panel QA di Proyek QA sekarang."
          : mode === "unsupported-remembered-bank"
            ? "Berapa saldo Rekening QA pada akhir September 2026? Jangan gunakan saldo saat ini sebagai pengganti, dan jangan simpan perubahan."
            : mode === "unsupported-snapshot"
              ? "Berapa saldo Rekening QA pada akhir September 2026?"
              : mode.startsWith("mixed-history")
                ? mixedHistoryQuestion
                : historyQuestion;
const currentExpense = {
  appliedFilters: ["Deskripsi cocok Biaya panel QA"],
  offset: 0,
  limit: 20,
  hasMore: false,
  nextOffset: null,
  matchedCount: 1,
  requiresExpenseChoice: false,
  project: { id: projectId, name: "Proyek QA" },
  dateBasis: "expenseDate",
  timeZone: "Asia/Jakarta",
  expenses: [
    {
      id: expenseId,
      projectCostId: null,
      description: "Biaya panel QA",
      projectId,
      projectName: "Proyek QA",
      categoryId: "material",
      categoryCode: "MATERIAL",
      categoryName: "Material",
      exactAmount: "150000.25",
      amount: { amount: 9000000, formatted: "Rp 9.000.000 MODEL_WRONG_FORMAT" },
      status: "APPROVED",
      paymentStatus: "UNPAID",
      expenseDate: "2026-10-12",
      sourceType: "CASH_EXPENSE",
      isCashImpact: true,
    },
  ],
};
const zeroExclusions = {
  opening: { count: 0, amount: "0.00" },
  transfer: { count: 0, amount: "0.00" },
  adjustment: { count: 0, amount: "0.00" },
  unclassified: { count: 0, amount: "0.00" },
};
function historyOutput(): FinancialHistoryOutput {
  const request = parseFinancialHistoryRequest(readQuestion, new Date(asOf));
  if (request.error || request.periods.length !== 2)
    throw new Error(`Fixture history period expected: ${request.error}`);
  return {
    kind: "financial-history",
    asOf,
    timeZone: "Asia/Jakarta",
    comparison: true,
    scope: mode.startsWith("mixed-history")
      ? { kind: "company", label: "Seluruh catatan perusahaan ini" }
      : mode === "wrong-scope"
        ? {
            kind: "project",
            projectId: "00000000-0000-4000-8000-000000000009",
            projectName: "Proyek asing",
            label: "Proyek asing",
          }
        : {
            kind: "project",
            projectId,
            projectName: mode === "stock-cost-comparison" ? "Proyek Operasional QA" : "Proyek QA",
            label: mode === "stock-cost-comparison" ? "Proyek Operasional QA" : "Proyek QA",
          },
    periods: request.periods.map((range, index) => ({
      ...range,
      ...(mode === "wrong-period" && index === 0 ? { start: "2026-08-31T17:00:00.000Z" } : {}),
      expenses: {
        recordedExpenseAmount: index === 0 ? "775000.25" : "0.00",
        recordedCount: index === 0 ? 3 : 0,
        pendingAmount: index === 0 ? "125000.00" : "0.00",
        pendingCount: index === 0 ? 1 : 0,
        excludedAmount: index === 0 ? "1000000.00" : "0.00",
        excludedCount: index === 0 ? 1 : 0,
        groups:
          index === 0
            ? [
                {
                  categoryId: "material",
                  categoryName: "Material",
                  status: "APPROVED",
                  sourceType: "CASH_EXPENSE",
                  amount: "775000.25",
                  count: 3,
                },
              ]
            : [],
      },
      ...(mode === "mixed-history-complete"
        ? {
            cash: {
              cashIn: index === 0 ? "2000000.00" : "0.00",
              cashOut: index === 0 ? "1000000.00" : "0.00",
              net: index === 0 ? "1000000.00" : "0.00",
              transactionCount: index === 0 ? 2 : 0,
              exclusions: zeroExclusions,
            },
          }
        : {}),
    })),
    issues: [],
  };
}
const tools = {
  getProjectBudget: tool({
    inputSchema: z.object({ projectId: z.guid() }).strict(),
    execute: async () => {
      unrelatedReads++;
      return { error: "Current budget is not a historical expense report." };
    },
  }),
  getWarehouseContext: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      unrelatedReads++;
      return { error: "Current stock is not a historical expense report." };
    },
  }),
  getRecentExpenses: tool({
    inputSchema: z.object({
      query: z.string().optional(),
      projectId: z.guid().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }),
    execute: async () =>
      mode === "paginated-current-only"
        ? { ...currentExpense, limit: 1, hasMore: true, nextOffset: 1, matchedCount: 8 }
        : currentExpense,
  }),
  getFinancialHistory: tool({
    inputSchema: z.object({ projectId: z.guid().optional() }).strict(),
    execute: async () => {
      historyReads++;
      return mode.startsWith("unsupported-")
        ? {
            error:
              "Riwayat saldo pada tanggal lampau belum tersedia sebagai snapshot terverifikasi.",
          }
        : historyOutput();
    },
  }),
  getBankBalances: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      bankReads++;
      return {
        accountCount: 1,
        scope: "Seluruh rekening aktif perusahaan ini",
        totalAvailable: { amount: 1000000, formatted: "Rp 9.000.000 MODEL_WRONG_FORMAT" },
        accounts: [
          {
            accountId,
            accountName: "Rekening QA",
            bankName: "Bank QA",
            balance: { amount: 1000000, formatted: "Rp 9.000.000 MODEL_WRONG_FORMAT" },
          },
        ],
      };
    },
  }),
  listProjects: tool({
    inputSchema: z.object({ limit: z.number().default(10) }),
    execute: async () => ({
      matchedCount: 2,
      hasMore: true,
      appliedFilters: [],
      projects: [{ projectId, name: "Proyek QA", status: "DRAFT" }],
    }),
  }),
  getAvailableActions: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => ({
      available: ["getRecentExpenses", "getFinancialHistory", "proposeBankCash"],
    }),
  }),
  proposeBankCash: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      proposalsExecuted++;
      return { proposal: { kind: "CASH_MOVEMENT" } };
    },
  }),
};
function call(name: string, input: string, id: string): LanguageModelV4StreamPart {
  return { type: "tool-call", toolName: name, input, toolCallId: id };
}
const falseClaim: LanguageModelV4StreamPart[] = [
  { type: "text-start", id: "wrong" },
  {
    type: "text-delta",
    id: "wrong",
    delta:
      "MODEL_FALSE_ASSERTION: semua pengeluaran lunas Rp 9.000.000 pada Agustus 2026, naik 100%. Saldo historis Rp 9.000.000.",
  },
  { type: "text-end", id: "wrong" },
];
const model = new MockLanguageModelV4({
  doStream: async (options): Promise<{ stream: ReadableStream<LanguageModelV4StreamPart> }> => {
    sent.push(options);
    const step = sent.length;
    let calls: LanguageModelV4StreamPart[] = [];
    if (mode === "forbidden-proposal")
      calls =
        step === 1
          ? [call("getAvailableActions", "{}", "discovery")]
          : step === 2
            ? [call("proposeBankCash", "{}", "forbidden")]
            : step === 3
              ? [call("getFinancialHistory", JSON.stringify({ projectId }), "verified-history")]
              : [];
    else if (mode === "unsupported-remembered-bank" && step === 1)
      calls = [call("getBankBalances", "{}", "remembered-bank")];
    else if (step === 1 && mode === "project-count-current")
      calls = [
        call("listProjects", '{"limit":1}', "projects"),
        call("getBankBalances", "{}", "cash"),
      ];
    else if (step === 1 && mode === "mixed-current")
      calls = [
        call(
          "getRecentExpenses",
          JSON.stringify({ query: "Biaya panel QA", projectId, limit: 20, offset: 0 }),
          "status",
        ),
        call("getBankBalances", "{}", "cash"),
      ];
    else if (step === 1 && (mode === "expense-status" || mode === "paginated-current-only"))
      calls = [
        call(
          "getRecentExpenses",
          JSON.stringify({ query: "Biaya panel QA", projectId, limit: 20, offset: 0 }),
          "status",
        ),
      ];
    else if (step === 1 && mode !== "stale-history-only")
      calls = [
        call(
          "getFinancialHistory",
          JSON.stringify(
            mode.startsWith("mixed-history") || mode === "unsupported-snapshot"
              ? {}
              : { projectId },
          ),
          "history",
        ),
      ];
    return {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          ...falseClaim,
          ...calls,
          {
            type: "finish",
            finishReason: { unified: calls.length ? "tool-calls" : "stop", raw: "fixture" },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 5, text: 5, reasoning: 0 },
            },
          },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    };
  },
});
mock.module("../providers", () => ({
  resolveProviderChain: () => ["NINEROUTER"],
  resolveChatModel: () => model,
  isFallbackWorthyError: () => false,
}));
mock.module("../tools", () => ({
  buildAiTools: (context: unknown) => {
    const parsed = z
      .object({ userQuestion: z.string(), asOf: z.string().datetime() })
      .parse(context);
    readQuestion = parsed.userQuestion;
    asOf = parsed.asOf;
    return tools;
  },
}));
const { runChatStream } = await import("../chat-stream");
const modelQuestion =
  mode === "attachment-boundary"
    ? `${question}\n\n[Data Berkas Teks: transfer.csv]\nTransfer bank, simpan perubahan, Agustus 2026,9000000`
    : question;
const messages: UIMessage[] = [
  {
    id: "old-user",
    role: "user",
    parts: [{ type: "text", text: "Bandingkan pengeluaran Agustus 2026" }],
  },
  {
    id: "old-assistant",
    role: "assistant",
    parts: [
      { type: "text", text: "STALE_HISTORY Rp 9.000.000" },
      {
        type: "tool-getFinancialHistory",
        toolCallId: "old-history",
        input: { projectId },
        state: "output-available",
        output: {
          kind: "financial-history",
          scope: { kind: "project", projectName: "Proyek QA" },
          periods: [{ label: "Agustus 2026", expenses: { recordedExpenseAmount: "9000000.00" } }],
        },
      },
    ],
  },
  { id: "current", role: "user", parts: [{ type: "text", text: modelQuestion }] },
];
const before = JSON.stringify(messages);
let saved: UIMessage | undefined;
const { stream } = runChatStream({
  messages,
  userQuestion: question,
  toolContext: {
    userId: "fixture",
    roleId: "fixture",
    roleName: "Owner",
    permissions: [
      "use:ai_chat",
      "view:project",
      "view:cost",
      "view:bank_account",
      "create:bank_account",
    ],
    dataScope: "GLOBAL",
  },
  conversationId: "fixture",
  userName: "QA",
  companyName: "QA",
  preference: { responseStyle: "STANDARD", primaryFocus: "AUTO", customNote: null },
  onAssistantMessage: async (event): Promise<void> => {
    saved = event.message;
  },
});
const chunks: UIMessageChunk[] = [];
const reader = stream.getReader();
try {
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
} finally {
  reader.releaseLock();
}
const published = chunks
  .flatMap((chunk) => (chunk.type === "text-delta" ? [chunk.delta] : []))
  .join("");
const persisted = saved?.parts
  .flatMap((part) => (part.type === "text" ? [part.text] : []))
  .join("");
const statuses = chunks.flatMap((chunk) =>
  chunk.type === "data-grounded-facts" && "data" in chunk
    ? [z.object({ status: z.string(), sources: z.array(z.unknown()) }).parse(chunk.data)]
    : [],
);
expect(persisted).toBe(published);
expect(saved).toBeDefined();
expect(published).not.toContain("MODEL_FALSE_ASSERTION");
expect(published).not.toContain("9.000.000");
expect(published).not.toContain("Agustus 2026");
expect(JSON.stringify(messages)).toBe(before);
expect(proposalsExecuted).toBe(0);
expect(
  sent.every(
    (options) =>
      !options.tools?.some(
        (entry) => entry.type === "function" && entry.name === "proposeBankCash",
      ),
  ),
).toBe(true);
expect(statuses).toHaveLength(1);
const status = statuses[0].status;
if (mode === "project-count-current") {
  expect(status).toBe("verified");
  expect(published).toContain("2 proyek");
  expect(published).toContain("1.000.000");
  expect(sent).toHaveLength(1);
} else if (["expense-status", "mixed-current"].includes(mode)) {
  expect(status).toBe("verified");
  expect(published).toContain("150.000,25");
  expect(published).toContain("Disetujui");
  expect(published).toContain("Belum dibayar");
  expect(
    saved?.parts.some(
      (part) => part.type === "tool-getRecentExpenses" && part.state === "output-available",
    ),
  ).toBe(true);
  if (mode === "mixed-current") expect(published).toContain("1.000.000");
} else if (
  [
    "full-comparison",
    "stock-cost-comparison",
    "attachment-boundary",
    "forbidden-proposal",
    "mixed-history-complete",
  ].includes(mode)
) {
  expect(status).toBe("verified");
  expect(published).toContain("775.000,25");
  expect(published).toContain("Oktober 2026");
  expect(published).toContain("September 2026");
  expect(published).toContain("persentase tidak dihitung");
  expect(historyReads).toBe(1);
  expect(
    saved?.parts.some(
      (part) => part.type === "tool-getFinancialHistory" && part.state === "output-available",
    ),
  ).toBe(true);
  if (mode === "mixed-history-complete") {
    expect(published).toContain("Kas masuk");
    expect(published).toContain("2.000.000");
  }
  if (mode === "attachment-boundary") {
    expect(readQuestion).toBe(question);
    expect(JSON.stringify(sent[0].prompt)).toContain("transfer.csv");
    expect(sent).toHaveLength(1);
  }
  if (mode === "stock-cost-comparison") {
    const unrelated = new Set(["getRecentExpenses", "getProjectBudget", "getWarehouseContext"]);
    expect(
      sent.every(
        (options) =>
          !options.tools?.some((entry) => entry.type === "function" && unrelated.has(entry.name)),
      ),
    ).toBe(true);
    expect(unrelatedReads).toBe(0);
  }
  if (mode === "forbidden-proposal")
    expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(true);
} else if (mode === "mixed-history-partial") {
  expect(status).toBe("partial");
  expect(published).toContain("775.000,25");
  expect(published).toContain("Riwayat arus kas belum tersedia");
} else if (mode.startsWith("unsupported-")) {
  expect(status).toBe("error");
  expect(published).toContain("snapshot");
  expect(published).not.toContain("Rp");
  expect(sent.length).toBeLessThanOrEqual(2);
  expect(bankReads).toBe(0);
  expect(
    saved?.parts.some(
      (part) => part.type === "tool-getBankBalances" && part.state === "output-available",
    ),
  ).toBe(false);
  expect(
    sent.every(
      (options) =>
        !options.tools?.some(
          (entry) => entry.type === "function" && entry.name === "getBankBalances",
        ),
    ),
  ).toBe(true);
} else {
  expect(status).not.toBe("verified");
  expect(published).not.toContain("775.000,25");
  expect(published).not.toContain("150.000,25");
  if (mode === "wrong-period") expect(published).toContain("Periode");
  if (mode === "wrong-scope") expect(published).toContain("Cakupan");
  if (mode === "stale-history-only") expect(historyReads).toBe(0);
}
console.log("final factual SDK fixture passed");
