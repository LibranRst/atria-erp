import { expect, mock } from "bun:test";
import { simulateReadableStream, tool, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { z } from "zod";

const mode = process.argv[2];
const sent: LanguageModelV4CallOptions[] = [];
let bankReads = 0;
let proposalsExecuted = 0;
const accountId = "00000000-0000-4000-8000-000000000001";
const bankOutput = {
  accountCount: 1,
  scope: "Seluruh rekening aktif perusahaan ini",
  totalAvailable: { amount: 1000000, formatted: "Rp 25.000.000 (untrusted formatted text)" },
  accounts: [
    {
      accountId,
      accountName: "Rekening QA",
      bankName: "Bank QA",
      balance: { amount: 1000000, formatted: "Rp 25.000.000 (untrusted formatted text)" },
    },
  ],
};
const tools = {
  getBankBalances: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      bankReads++;
      if (mode === "retry-throw" && bankReads === 1)
        throw new Error("Temporary bank reader failure.");
      return mode === "failed-read" ? { error: "Layanan saldo belum dapat dibaca." } : bankOutput;
    },
  }),
  getAvailableActions: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => ({ available: ["getBankBalances", "proposeBankCash"] }),
  }),
  getInventoryLocations: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => ({ locations: [] }),
  }),
  getWarehouseContext: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => ({ inventory: [], location: null }),
  }),
  proposeBankCash: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      proposalsExecuted++;
      return { proposal: { kind: "CASH_MOVEMENT" } };
    },
  }),
};
const toolCall = (name: string, id = name, input = "{}"): LanguageModelV4StreamPart => ({
  type: "tool-call",
  toolCallId: id,
  toolName: name,
  input,
});
const assertion: LanguageModelV4StreamPart[] = [
  { type: "text-start", id: "model-claim" },
  {
    type: "text-delta",
    id: "model-claim",
    delta: "Saldo Rekening QA sekarang Rp 25.000.000. Semua stok tersedia.",
  },
  { type: "text-end", id: "model-claim" },
];
const model = new MockLanguageModelV4({
  doStream: async (options) => {
    sent.push(options);
    const step = sent.length;
    if (mode === "provider-error") {
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            ...assertion,
            {
              type: "error",
              error: new Error("PRIVATE_PROVIDER_KEY_fixture PRIVATE_PROMPT_fixture"),
            },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      };
    }
    const calls =
      mode === "no-read"
        ? []
        : mode === "forbidden-proposal"
          ? [
              toolCall(
                step === 1
                  ? "getAvailableActions"
                  : step === 2
                    ? "proposeBankCash"
                    : "getBankBalances",
                `call-${step}`,
              ),
            ]
          : mode === "invalid-read"
            ? step <= 2
              ? [toolCall("getBankBalances", `invalid-bank-${step}`, '{"unexpected":true}')]
              : []
            : mode === "failed-read" || mode === "retry-throw"
              ? step <= 2
                ? [toolCall("getBankBalances", `bank-${step}`)]
                : []
              : step === 1
                ? [toolCall("getBankBalances")]
                : [];
    return {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          // Emit the false claim before valid results in the same SDK step. None of
          // these model assertions may appear in either the published or saved text.
          ...assertion,
          ...calls,
          {
            type: "finish",
            finishReason: { unified: calls.length ? "tool-calls" : "stop", raw: "fixture" },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 2, text: 2, reasoning: 0 },
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
mock.module("../tools", () => ({ buildAiTools: () => tools }));
const { runChatStream } = await import("../chat-stream");
const question =
  mode === "partial"
    ? "Cek saldo Rekening QA sekarang dan stok Panel QA di Gudang QA."
    : "Cek saldo Rekening QA sekarang. Jangan menyimpan perubahan.";
const modelQuestion =
  mode === "attachment-boundary"
    ? `${question}\n\n[Data Berkas Teks: rekening.csv]\nTanggal,Keterangan,Nominal\n2026-10-13,Transfer bank,25000000`
    : question;
const original: UIMessage[] = [
  {
    id: "old-user",
    role: "user",
    parts: [{ type: "text", text: "Cek saldo Rekening QA sebelumnya" }],
  },
  {
    id: "old-assistant",
    role: "assistant",
    parts: [
      { type: "text", text: "HISTORICAL_ASSERTION Saldo Rekening QA Rp 25.000.000." },
      {
        type: "tool-getBankBalances",
        toolCallId: "old-read",
        input: {},
        state: "output-available",
        output: {
          ...bankOutput,
          totalAvailable: { amount: 25000000, formatted: "Rp 25.000.000" },
          accounts: bankOutput.accounts.map((account) => ({
            ...account,
            balance: { amount: 25000000, formatted: "Rp 25.000.000" },
          })),
        },
      },
    ],
  },
  { id: "current", role: "user", parts: [{ type: "text", text: modelQuestion }] },
];
const before = JSON.stringify(original);
let saved: UIMessage | undefined;
const { stream } = runChatStream({
  messages: original,
  ...(mode === "attachment-boundary" ? { userQuestion: question } : {}),
  toolContext: {
    userId: "fixture",
    roleId: "fixture",
    roleName: "Owner",
    permissions: ["use:ai_chat", "view:bank_account", "create:bank_account"],
    dataScope: "GLOBAL",
  },
  conversationId: "fixture",
  userName: "QA",
  companyName: "QA",
  preference: { responseStyle: "STANDARD", primaryFocus: "AUTO", customNote: null },
  onAssistantMessage: async (event) => {
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
const stored = saved?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
expect(published).not.toContain("25.000.000");
expect(published).not.toContain("Semua stok tersedia");
expect(stored ?? "").not.toContain("25.000.000");
expect(JSON.stringify(original)).toBe(before);
expect(proposalsExecuted).toBe(0);
expect(
  sent.every(
    (options) =>
      !options.tools?.some(
        (entry) => entry.type === "function" && entry.name === "proposeBankCash",
      ),
  ),
).toBe(true);
if (mode === "provider-error") {
  expect(chunks.filter((chunk) => chunk.type === "error")).toHaveLength(1);
  expect(JSON.stringify(chunks)).not.toContain("PRIVATE_PROVIDER_KEY_fixture");
  expect(JSON.stringify(chunks)).not.toContain("PRIVATE_PROMPT_fixture");
  expect(saved).toBeUndefined();
} else if (mode === "forbidden-proposal") {
  expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(true);
  expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
  expect(published).toContain("1.000.000");
  expect(stored).toBe(published);
  expect(saved?.parts.some((part) => "state" in part && part.state === "output-error")).toBe(true);
} else {
  expect(stored).toBe(published);
  expect(saved).toBeDefined();
  const expectedStatus =
    mode === "no-read"
      ? "waiting"
      : mode === "failed-read" || mode === "invalid-read"
        ? "error"
        : mode === "partial"
          ? "partial"
          : "verified";
  expect(
    chunks.some(
      (chunk) =>
        chunk.type === "data-grounded-facts" &&
        "data" in chunk &&
        typeof chunk.data === "object" &&
        chunk.data !== null &&
        "status" in chunk.data &&
        chunk.data.status === expectedStatus,
    ),
  ).toBe(true);
  if (mode === "wrong-claim" || mode === "partial" || mode === "attachment-boundary") {
    expect(published).toContain("1.000.000");
    expect(
      saved?.parts.some(
        (part) => part.type === "tool-getBankBalances" && part.state === "output-available",
      ),
    ).toBe(true);
  }
  if (mode === "wrong-claim" || mode === "attachment-boundary") {
    expect(sent).toHaveLength(1);
    expect(bankReads).toBe(1);
  }
  if (mode === "attachment-boundary") {
    expect(JSON.stringify(sent[0].prompt)).toContain("Transfer bank");
    expect(JSON.stringify(sent[0].prompt)).toContain("rekening.csv");
    expect(published).not.toContain("25000000");
  }
  if (mode === "no-read") {
    expect(bankReads).toBe(0);
    expect(published).toContain("belum terverifikasi");
  }
  if (mode === "failed-read") {
    expect(bankReads).toBe(2);
    expect(published).toContain("Layanan saldo belum dapat dibaca");
  }
  if (mode === "invalid-read") {
    expect(bankReads).toBe(0);
    expect(published).toContain("belum dapat diverifikasi");
    expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(true);
    expect(saved?.parts.some((part) => "state" in part && part.state === "output-error")).toBe(
      true,
    );
  }
  if (mode === "retry-throw") {
    expect(bankReads).toBe(2);
    expect(published).toContain("1.000.000");
    expect(published).not.toContain("belum dapat diverifikasi");
    expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
    const failedIndex =
      saved?.parts.findIndex((part) => "state" in part && part.state === "output-error") ?? -1;
    const recoveredIndex =
      saved?.parts.findIndex(
        (part) => part.type === "tool-getBankBalances" && part.state === "output-available",
      ) ?? -1;
    expect(failedIndex).toBeGreaterThanOrEqual(0);
    expect(recoveredIndex).toBeGreaterThan(failedIndex);
  }
}
console.log("grounded SDK fixture passed");
