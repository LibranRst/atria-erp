import { expect, mock } from "bun:test";
import { simulateReadableStream, tool, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { z } from "zod";
import type { ChatStreamInput } from "../chat-stream";

const mode = process.argv[2];
const expenseRouting = mode.startsWith("expense-");
const grounded = mode === "grounded" || mode === "retry";
const toolName = mode === "reordered" || expenseRouting ? "listProjects" : "getBankBalances";
const usedProfiles: (string | undefined)[] = [];
const sent: LanguageModelV4CallOptions[] = [];
const resolved: string[] = [];
const executedInputs: unknown[] = [];
const availableInputs: unknown[] = [];
const saved: UIMessage[] = [];
const intro = 'Aku akan membaca "rekening pilihanmu" sebelum menyiapkan ringkasan.';
const bankOutput = {
  accountCount: 1,
  scope: "Seluruh rekening aktif perusahaan ini",
  totalAvailable: { amount: 1_000_000, formatted: "Rp 1.000.000" },
  accounts: [
    {
      accountId: "00000000-0000-4000-8000-000000000001",
      accountName: "Rekening QA",
      bankName: "Bank QA",
      balance: { amount: 1_000_000, formatted: "Rp 1.000.000" },
    },
  ],
};
const tools = {
  [toolName]: tool({
    inputSchema: z.object({ query: z.string().optional() }).strict(),
    onInputAvailable: async ({ input }): Promise<void> => {
      availableInputs.push(input);
    },
    execute: async (input) => {
      executedInputs.push(input);
      if (mode === "retry" && executedInputs.length === 1)
        throw new Error("Temporary read failure.");
      return bankOutput;
    },
  }),
  ...(expenseRouting
    ? {
        proposeExpenseDraft: tool({
          inputSchema: z.object({}).strict(),
          execute: async (): Promise<{ error: string }> => {
            throw new Error("Fixture proposal must not execute.");
          },
        }),
      }
    : {}),
};
const model = new MockLanguageModelV4({
  doStream: async (options) => {
    sent.push(options);
    const first = sent.length === 1;
    const reading = first || (mode === "retry" && sent.length === 2);
    const callId = `bank-call-${sent.length}`;
    const textId = `model-text-${sent.length}`;
    const input = JSON.stringify(
      first
        ? {
            ...(mode === "reordered" ? { query: "QA" } : {}),
            _introduction: mode === "invalid" ? "Saldo sudah berhasil dibaca." : intro,
          }
        : {},
    );
    const parts: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings: [] },
      ...(reading
        ? [
            { type: "tool-input-start" as const, id: callId, toolName },
            // Split both an escaped quote and the closing string delimiter.
            { type: "tool-input-delta" as const, id: callId, delta: input.slice(0, 45) },
            { type: "tool-input-delta" as const, id: callId, delta: input.slice(45, -1) },
            ...(mode === "late-error"
              ? [{ type: "error" as const, error: new Error("PRIVATE_provider_failure") }]
              : [
                  { type: "tool-input-delta" as const, id: callId, delta: input.slice(-1) },
                  { type: "tool-input-end" as const, id: callId },
                  {
                    type: "tool-call" as const,
                    toolCallId: callId,
                    toolName,
                    input,
                  },
                ]),
          ]
        : []),
      ...(mode !== "late-error"
        ? [
            { type: "text-start" as const, id: textId },
            {
              type: "text-delta" as const,
              id: textId,
              delta: grounded
                ? "Saldo QA Rp 99.000.000 (klaim model palsu)."
                : first
                  ? ""
                  : "Berikut ringkasan rekening dari sumber terbaru.",
            },
            { type: "text-end" as const, id: textId },
            {
              type: "finish" as const,
              finishReason: {
                unified: reading ? ("tool-calls" as const) : ("stop" as const),
                raw: "fixture",
              },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
              },
            },
          ]
        : []),
    ];
    return {
      stream: simulateReadableStream({
        chunks: parts,
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    };
  },
});
const failBeforeResponse = new MockLanguageModelV4({
  doStream: async () => {
    throw new Error("PRIVATE_provider_failure");
  },
});
mock.module("@backend/lib/ai/providers", (): Record<string, unknown> => ({
  resolveProviderChain: (): readonly string[] =>
    expenseRouting
      ? ["NINEROUTER"]
      : mode === "fallback" || mode === "late-error"
        ? ["DEEPSEEK", "GEMINI"]
        : ["DEEPSEEK"],
  resolveChatModel: (provider: string, profile?: string): MockLanguageModelV4 => {
    resolved.push(provider);
    if (expenseRouting)
      return new MockLanguageModelV4({
        modelId: `fixture-${profile ?? "default"}`,
        doStream: async (options) => {
          usedProfiles.push(profile);
          return model.doStream(options);
        },
      });
    return mode === "fallback" && provider === "DEEPSEEK" ? failBeforeResponse : model;
  },
  isFallbackWorthyError: (): boolean => true,
}));
mock.module("@backend/lib/ai/prompts", (): Record<string, unknown> => ({
  buildSystemPrompt: (): string => "fixture",
}));
mock.module("@backend/lib/ai/tools", (): Record<string, unknown> => ({
  buildAiTools: (): object => tools,
}));
const { runChatStream } = await import("../chat-stream");
const question = expenseRouting
  ? mode === "expense-complex"
    ? "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek Operasional QA lalu bayar tagihan vendor."
    : `Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek ${mode === "expense-ambiguous" ? "QA" : "Operasional QA"}. Jangan simpan perubahan.`
  : grounded
    ? "Berapa saldo rekening terbaru?"
    : "Jelaskan cara meninjau pekerjaan.";
const input: ChatStreamInput = {
  userQuestion: question,
  messages: [{ id: "fixture-user", role: "user", parts: [{ type: "text", text: question }] }],
  toolContext: {
    userId: "fixture",
    roleName: "OWNER",
    roleId: "fixture",
    permissions: ["use:ai_chat"],
    dataScope: "GLOBAL",
  },
  userName: "Fixture",
  conversationId: "fixture-conversation",
  companyName: "Fixture",
  preference: { responseStyle: "STANDARD", primaryFocus: "AUTO", customNote: null },
  hasAttachments: mode === "expense-document",
  onAssistantMessage: async ({ message }): Promise<void> => {
    saved.push(message);
  },
};
const chunks: UIMessageChunk[] = [];
const reader = runChatStream(input).stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
}
const introductions = chunks.filter((chunk) => chunk.type === "data-assistant-introduction");
expect(introductions.length).toBe(mode === "invalid" ? 0 : 1);
if (mode !== "invalid") {
  expect(introductions[0]).toMatchObject({ id: "assistant-introduction", data: { text: intro } });
  const introductionIndex = chunks.findIndex(
    (chunk) => chunk.type === "data-assistant-introduction",
  );
  expect(chunks.findIndex((chunk) => chunk.type === "start")).toBeLessThan(introductionIndex);
  const availableIndex = chunks.findIndex((chunk) => chunk.type === "tool-input-available");
  if (availableIndex !== -1) expect(availableIndex).toBeGreaterThan(introductionIndex);
}
expect(JSON.stringify(chunks)).not.toContain("PRIVATE_provider_failure");
if (mode === "late-error") {
  expect(resolved).toEqual(["DEEPSEEK"]);
  expect(saved.length).toBe(0);
  expect(executedInputs).toEqual([]);
  expect(chunks.filter((chunk) => chunk.type === "error").length).toBe(1);
} else {
  expect(saved.length).toBe(1);
  const originalInput = mode === "reordered" ? { query: "QA" } : {};
  expect(executedInputs).toEqual(mode === "retry" ? [{}, {}] : [originalInput]);
  expect(availableInputs).toEqual(mode === "retry" ? [{}, {}] : [originalInput]);
  const toolInput = chunks.find((chunk) => chunk.type === "tool-input-available");
  expect(toolInput?.type === "tool-input-available" ? toolInput.input : null).toEqual(
    originalInput,
  );
  expect(saved[0].parts.filter((part) => part.type === "data-assistant-introduction").length).toBe(
    mode === "invalid" ? 0 : 1,
  );
  if (mode !== "invalid")
    expect(
      JSON.stringify(saved[0].parts.find((part) => part.type === "data-assistant-introduction")),
    ).toBe(JSON.stringify(introductions[0]));
  const persistedTool = saved[0].parts.find((part) => part.type === `tool-${toolName}`);
  expect(persistedTool && "input" in persistedTool ? persistedTool.input : null).toEqual(
    originalInput,
  );
  expect(sent.length).toBe(mode === "retry" ? 2 : grounded ? 1 : 2);
  if (sent.length > 1) {
    const secondSchema = sent[1].tools?.find(
      (current) => current.type === "function" && current.name === toolName,
    );
    if (secondSchema?.type === "function")
      expect(secondSchema.inputSchema.properties).not.toHaveProperty("_introduction");
  }
  if (grounded) {
    expect(JSON.stringify(chunks)).not.toContain("99.000.000");
    expect(JSON.stringify(saved)).not.toContain("99.000.000");
    expect(
      saved[0].parts.some((part) => part.type === "text" && part.text.includes("1.000.000")),
    ).toBe(true);
    expect(sent[0].toolChoice).toEqual({ type: "tool", toolName: "getBankBalances" });
  }
  if (mode === "fallback") expect(resolved).toEqual(["DEEPSEEK", "GEMINI"]);
  if (expenseRouting) {
    expect(usedProfiles).toEqual(
      mode === "expense-first"
        ? ["simple", "bounded"]
        : mode === "expense-complex"
          ? ["complex", "complex"]
          : ["bounded", "bounded"],
    );
    expect(sent.length).toBe(2);
    expect(sent[0].toolChoice).toEqual({ type: "auto" });
  }
}
console.log("fixture passed");
