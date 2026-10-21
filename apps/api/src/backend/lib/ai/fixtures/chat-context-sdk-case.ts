import { expect, mock } from "bun:test";
import { simulateReadableStream, tool, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { z } from "zod";

const sent: LanguageModelV4CallOptions[] = [];
const unexpected = process.argv[2] === "unexpected";
const verified = process.argv[2] === "verified";
const unverified = process.argv[2] === "unverified";
const prefetched = process.argv[2] === "prefetched";
let unrelatedExecutions = 0;
const tools = {
  getOwnProfileContext: tool({
    inputSchema: z.object({}),
    execute: async () => ({ name: "Actual" }),
  }),
  getBankBalances: tool({
    inputSchema: z.object({}),
    execute: async () => ({
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
    }),
  }),
  getAvailableActions: tool({
    inputSchema: z.object({}),
    execute: async () => ({
      available: ["getBankBalances", "getAvailableActions", "proposeCreateUser"],
    }),
  }),
  proposeCreateUser: tool({
    inputSchema: z.object({ name: z.string() }),
    execute: async (input) => {
      unrelatedExecutions++;
      return { proposal: { name: input.name } };
    },
  }),
};
const model = new MockLanguageModelV4({
  doStream: async (options) => {
    sent.push(options);
    const finish: LanguageModelV4StreamPart = {
      type: "finish",
      finishReason: {
        unified: !prefetched && sent.length === 1 ? "tool-calls" : "stop",
        raw: "fixture",
      },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 2, text: 2, reasoning: 0 },
      },
    };
    const chunks: LanguageModelV4StreamPart[] = prefetched
      ? [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "current-profile" },
          { type: "text-delta", id: "current-profile", delta: "SERVER_FRESH_QA" },
          { type: "text-end", id: "current-profile" },
          finish,
        ]
      : unverified
        ? [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "unsafe" },
            { type: "text-delta", id: "unsafe", delta: "UNVERIFIED_BANK_BALANCE" },
            { type: "text-end", id: "unsafe" },
            finish,
          ]
        : sent.length === 1
          ? [
              { type: "stream-start", warnings: [] },
              {
                type: "tool-call",
                toolCallId: "discovery",
                toolName: verified
                  ? "getBankBalances"
                  : unexpected
                    ? "proposeCreateUser"
                    : "getAvailableActions",
                input: unexpected ? '{"name":"QA"}' : "{}",
              },
              finish,
            ]
          : [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "answer" },
              { type: "text-delta", id: "answer", delta: "Katalog lengkap tersedia sesuai izin." },
              { type: "text-end", id: "answer" },
              finish,
            ];
    return {
      stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }),
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
const original: UIMessage[] = [
  {
    id: "old",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "HISTORICAL_REASONING_MUST_NOT_RETURN" },
      { type: "text", text: "Rekening yang tadi sudah dipilih." },
    ],
  },
  {
    id: "current",
    role: "user",
    parts: [
      {
        type: "text",
        text: prefetched
          ? "Siapa nama profil saya?"
          : verified || unverified
            ? "Berapa saldo rekening sekarang?"
            : "Jelaskan rekening yang tersedia?",
      },
    ],
  },
];
const { stream } = runChatStream({
  messages: original,
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
  ...(prefetched
    ? { verifiedOwnProfile: { name: "SERVER_FRESH_QA", imageUrl: null, hasPhoto: false } }
    : {}),
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
if (prefetched) {
  expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
  expect(JSON.stringify(sent[0].prompt)).toContain("SERVER_FRESH_QA");
  expect(saved?.parts.some((part) => part.type === "text" && part.text === "SERVER_FRESH_QA")).toBe(
    true,
  );
  console.log("context SDK fixture passed");
  process.exit(0);
}
if (unverified) {
  expect(
    chunks.some(
      (chunk) =>
        chunk.type === "data-grounded-facts" &&
        "data" in chunk &&
        typeof chunk.data === "object" &&
        chunk.data !== null &&
        "status" in chunk.data &&
        chunk.data.status === "waiting",
    ),
  ).toBe(true);
  expect(
    chunks.some(
      (chunk) => chunk.type === "text-delta" && chunk.delta.includes("UNVERIFIED_BANK_BALANCE"),
    ),
  ).toBe(false);
  expect(
    saved?.parts.some((part) => part.type === "text" && part.text.includes("belum terverifikasi")),
  ).toBe(true);
  console.log("context SDK fixture passed");
  process.exit(0);
}
expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
expect(sent).toHaveLength(verified ? 1 : 2);
const names = (options: LanguageModelV4CallOptions): string[] =>
  options.tools?.flatMap((t) => (t.type === "function" ? [t.name] : [])) ?? [];
expect(names(sent[0])).toEqual(["getBankBalances", "getAvailableActions"]);
if (!verified) expect(names(sent[1])).toContain("proposeCreateUser");
expect(JSON.stringify(sent[0].prompt)).not.toContain("HISTORICAL_REASONING_MUST_NOT_RETURN");
expect(JSON.stringify(original)).toContain("HISTORICAL_REASONING_MUST_NOT_RETURN");
expect(
  saved?.parts.some(
    (part) => part.type === (verified ? "tool-getBankBalances" : "tool-getAvailableActions"),
  ),
).toBe(true);
expect(unrelatedExecutions).toBe(0);
console.log("context SDK fixture passed");
