import { expect, mock } from "bun:test";
import { simulateReadableStream, tool, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { z } from "zod";

const mode = process.argv[2];
const sent: LanguageModelV4CallOptions[] = [];
const executions: string[] = [];
const locationId = "2f205425-71ab-425d-9ead-ebc5f1c1e600";
const inventory = [
  {
    materialId: "6106eb8b-8b6f-4923-9710-0ee45d320425",
    name: "Panel Operasional QA",
    unit: "lembar",
    currentStock: 6,
    reservedStock: 6,
  },
];
const record = (name: string): void => {
  executions.push(name);
};
const tools = {
  getBankBalances: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      record("getBankBalances");
      return mode === "failed-read"
        ? { error: "BANK_READER_UNAVAILABLE" }
        : {
            accountCount: 1,
            scope: "Seluruh rekening aktif perusahaan ini",
            totalAvailable: { amount: 1000000, formatted: "Rp 1.000.000" },
            accounts: [
              {
                accountId: "00000000-0000-4000-8000-000000000001",
                accountName: "Rekening QA",
                bankName: "Bank QA",
                balance: { amount: 1000000, formatted: "Rp 1.000.000" },
              },
            ],
          };
    },
  }),
  getInventoryLocations: tool({
    inputSchema: z.object({}).strict(),
    execute: async () => {
      record("getInventoryLocations");
      return { locations: [{ locationId, name: "Gudang Operasional QA" }] };
    },
  }),
  getStockCorrectionContext: tool({
    inputSchema: z
      .object({
        resource: z.literal("inventory"),
        inventoryLocationId: z.guid(),
        query: z.string(),
        offset: z.number().int(),
      })
      .strict(),
    execute: async () => {
      record("getStockCorrectionContext");
      return { items: inventory };
    },
  }),
  getMaterialCatalog: tool({
    inputSchema: z.object({ query: z.string(), limit: z.number().int() }).strict(),
    execute: async () => {
      record("getMaterialCatalog");
      return { materials: [{ name: "Panel Operasional QA" }] };
    },
  }),
  getWarehouseContext: tool({
    inputSchema: z.object({ inventoryLocationId: z.guid() }).strict(),
    execute: async () => {
      record("getWarehouseContext");
      return {
        location: { id: locationId, name: "Gudang Operasional QA" },
        hasMore: false,
        inventory: [
          {
            materialId: "6106eb8b-8b6f-4923-9710-0ee45d320425",
            name: "Panel Operasional QA",
            unit: "lembar",
            physical: "6.00",
            reserved: "6.00",
          },
        ],
      };
    },
  }),
  getAvailableActions: tool({
    inputSchema: z.object({}).strict(),
    execute: async (): Promise<{ available: string[] }> => {
      record("getAvailableActions");
      return { available: Object.keys(tools) };
    },
  }),
  proposeCreateUser: tool({
    inputSchema: z.object({ name: z.string() }).strict(),
    execute: async () => {
      record("proposeCreateUser");
      return { proposal: {} };
    },
  }),
};
const call = (name: string, input = "{}", id = name): LanguageModelV4StreamPart => ({
  type: "tool-call",
  toolCallId: id,
  toolName: name,
  input,
});
const stockInput = JSON.stringify({
  query: "Panel Operasional QA",
  offset: 0,
  resource: "inventory",
  inventoryLocationId: mode === "invalid-input" ? "not-a-guid" : locationId,
});
const catalogInput = JSON.stringify({ limit: 10, query: "Panel Operasional QA" });
const model = new MockLanguageModelV4({
  doStream: async (options) => {
    sent.push(options);
    const step = sent.length;
    let chunks: LanguageModelV4StreamPart[];
    if (mode === "failed-read") {
      chunks =
        step <= 2
          ? [call("getBankBalances", "{}", `bank-${step}`)]
          : [
              { type: "text-start", id: "unsafe" },
              { type: "text-delta", id: "unsafe", delta: "UNVERIFIED_BALANCE" },
              { type: "text-end", id: "unsafe" },
            ];
    } else if (step === 1) {
      chunks =
        mode === "out-of-stage"
          ? [call("proposeCreateUser", '{"name":"QA"}')]
          : mode === "forbidden"
            ? [call("unregisteredMoneyMutation")]
            : [
                call("getStockCorrectionContext", stockInput),
                call("getMaterialCatalog", catalogInput),
              ];
    } else if (step === 2) {
      chunks = [
        call("getBankBalances"),
        ...(mode === "out-of-stage" || mode === "forbidden" ? [] : [call("getInventoryLocations")]),
      ];
    } else if (mode === "invalid-input" && step === 3) {
      chunks = [call("getWarehouseContext", JSON.stringify({ inventoryLocationId: locationId }))];
    } else {
      chunks = [
        { type: "text-start", id: "answer" },
        { type: "text-delta", id: "answer", delta: "Saldo terverifikasi Rp 1.000.000." },
        { type: "text-end", id: "answer" },
      ];
    }
    const hasTools = chunks.some((chunk) => chunk.type === "tool-call");
    return {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          ...chunks,
          {
            type: "finish",
            finishReason: { unified: hasTools ? "tool-calls" : "stop", raw: "fixture" },
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
let saved: UIMessage | undefined;
const bankOnly = ["out-of-stage", "forbidden", "failed-read"].includes(mode ?? "");
const { stream } = runChatStream({
  messages: [
    {
      id: "current",
      role: "user",
      parts: [
        {
          type: "text",
          text:
            mode === "out-of-stage" || mode === "forbidden"
              ? "Bagaimana cek saldo rekening terbaru?"
              : mode === "invalid-input"
                ? "Bagaimana cek saldo rekening dan stok fisik terbaru Panel Operasional QA?"
                : bankOnly
                  ? "Cek saldo rekening sekarang."
                  : "Cek saldo rekening sekarang dan stok fisik terbaru Panel Operasional QA di Gudang Operasional QA.",
        },
      ],
    },
  ],
  toolContext: {
    userId: "fixture",
    roleId: "fixture",
    roleName: "Owner",
    permissions: ["use:ai_chat", "view:bank_account", "manage:users"],
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
expect(executions).not.toContain("proposeCreateUser");
if (mode === "failed-read") {
  expect(executions.filter((name) => name === "getBankBalances")).toHaveLength(2);
  expect(
    chunks.some(
      (chunk) =>
        chunk.type === "data-grounded-facts" &&
        "data" in chunk &&
        typeof chunk.data === "object" &&
        chunk.data !== null &&
        "status" in chunk.data &&
        chunk.data.status === "error",
    ),
  ).toBe(true);
  expect(
    chunks.some(
      (chunk) => chunk.type === "text-delta" && chunk.delta.includes("UNVERIFIED_BALANCE"),
    ),
  ).toBe(false);
  expect(
    saved?.parts.some(
      (part) => part.type === "text" && part.text.includes("belum dapat diverifikasi"),
    ),
  ).toBe(true);
  expect(JSON.stringify(saved)).toContain("BANK_READER_UNAVAILABLE");
} else {
  expect(saved).toBeDefined();
  expect(executions).toContain("getBankBalances");
  expect(sent[0].toolChoice).toEqual({ type: "tool", toolName: "getBankBalances" });
  if (mode === "competing") {
    expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(false);
    expect(executions).toContain("getStockCorrectionContext");
    expect(executions).toContain("getMaterialCatalog");
    expect(sent[1].toolChoice).toEqual({ type: "tool", toolName: "getBankBalances" });
  } else if (mode === "out-of-stage") {
    expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(false);
    expect(executions).toContain("getAvailableActions");
  } else {
    expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(true);
    expect(saved?.parts.some((part) => "state" in part && part.state === "output-error")).toBe(
      true,
    );
  }
}
console.log("sequence SDK fixture passed");
