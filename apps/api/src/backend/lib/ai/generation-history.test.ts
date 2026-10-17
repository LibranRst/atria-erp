import { describe, expect, test } from "bun:test";
import {
  convertToModelMessages,
  getToolName,
  isToolUIPart,
  simulateReadableStream,
  streamText,
  type UIMessage,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { generationMessages, initialActiveTools } from "./chat-context";

type Part = UIMessage["parts"][number];

function human(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistant(id: string, parts: Part[]): UIMessage {
  return { id, role: "assistant", parts };
}

function completedRead(callId: string, output: unknown = { balance: "125000000.25" }): Part {
  return {
    type: "dynamic-tool",
    toolName: "getBankBalances",
    toolCallId: callId,
    state: "output-available",
    input: {},
    output,
  };
}

function longHistory(latest = "Cek saldo aktual rekening QA"): UIMessage[] {
  const messages: UIMessage[] = [];
  for (let turn = 1; turn <= 10; turn += 1) {
    messages.push(
      human(`u-${turn}`, `Cek rekening QA ${turn}. Nilai historis Rp125.000.000,25.`),
      assistant(`a-${turn}`, [
        { type: "text", text: `Rekening QA ${turn}: ini hasil historis, bukan saldo sekarang.` },
        completedRead(`read-${turn}`, {
          accounts: [
            { id: `account-${turn}`, name: `Rekening QA ${turn}`, balance: "125000000.25" },
          ],
          obsoletePayload: `OBSOLETE_READ_${turn} `.repeat(200),
        }),
      ]),
    );
  }
  messages.push(human("latest", latest));
  return messages;
}

function callIds(messages: readonly UIMessage[]): string[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => (isToolUIPart(part) ? [part.toolCallId] : [])),
  );
}

describe("conservative generation history compaction", () => {
  test("keeps four recent human turns, every text and the exact persisted history", (): void => {
    const original = longHistory();
    const before = JSON.stringify(original);
    const compacted = generationMessages(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(callIds(compacted)).toEqual(["read-8", "read-9", "read-10"]);
    expect(compacted.filter((message) => message.role === "user")).toEqual(
      original.filter((message) => message.role === "user"),
    );
    for (const originalMessage of original.filter((message) => message.role === "assistant"))
      expect(compacted.find((message) => message.id === originalMessage.id)?.parts[0]).toEqual(
        originalMessage.parts[0],
      );
    expect(JSON.stringify(compacted).length).toBeLessThan(JSON.stringify(original).length / 2);
  });

  test("keeps a pending proposal, input wizard, files and server confirmations outside the window", (): void => {
    const proposal: Part = {
      type: "tool-proposeCreateProject",
      toolCallId: "pending-project",
      state: "output-available",
      input: { name: "Proyek Lama QA", totalContractValue: 125000000.25 },
      output: { proposal: { name: "Proyek Lama QA", totalContractValue: "125000000.25" } },
    };
    const inputRequest: Part = {
      type: "tool-requestUserInput",
      toolCallId: "pending-input",
      state: "output-available",
      input: { actionTitle: "Klien", fields: [{ key: "clientId", label: "Klien" }] },
      output: { status: "INPUT_REQUESTED", fields: [{ key: "clientId", label: "Klien" }] },
    };
    const confirmed = completedRead("confirmed", {
      isConfirmedByUser: true,
      confirmation: { documentId: "owned-document", status: "CONFIRMED_AND_EXECUTED" },
      amount: "125000000.25",
    });
    const file: Part = {
      type: "file",
      mediaType: "image/png",
      url: "data:image/png;base64,aGVsbG8=",
    };
    const original = [
      human("old", "Pilih Proyek Lama QA dan klien itu"),
      assistant("pending", [proposal, inputRequest, confirmed]),
      { ...human("file", "Gunakan lampiran ini"), parts: [file] },
      ...longHistory(),
    ];
    const compacted = generationMessages(original);
    expect(compacted.find((message) => message.id === "pending")?.parts).toEqual([
      proposal,
      inputRequest,
      confirmed,
    ]);
    expect(compacted.find((message) => message.id === "file")?.parts).toEqual([file]);
  });

  test("preserves unknown tools, errors, approval and interactive artifacts from read tools", (): void => {
    const parts: Part[] = [
      {
        type: "dynamic-tool",
        toolName: "unclassifiedFutureTool",
        toolCallId: "unknown",
        state: "output-available",
        input: {},
        output: { value: "unknown contract" },
      },
      completedRead("read-error", { error: "Masih menghambat", code: "FORBIDDEN" }),
      completedRead("read-failed", { toolFailed: true }),
      completedRead("read-proposal", { proposal: { id: "interactive-owned-proposal" } }),
      completedRead("read-input", { status: "INPUT_REQUESTED", fields: [] }),
      {
        type: "tool-getBankBalances",
        toolCallId: "approval",
        state: "approval-requested",
        input: {},
        approval: { id: "approval-id" },
      },
      {
        type: "tool-getBankBalances",
        toolCallId: "output-error",
        state: "output-error",
        input: {},
        errorText: "Database unavailable",
      },
    ];
    const compacted = generationMessages([assistant("protected", parts), ...longHistory()]);
    expect(compacted[0].parts).toEqual(parts);
  });

  test("keeps metadata-bound tool and reasoning sequences, including unannotated peer calls", (): void => {
    const parts: Part[] = [
      {
        type: "reasoning",
        text: "signed",
        providerMetadata: { google: { thoughtSignature: "opaque" } },
      },
      completedRead("signed-peer"),
    ];
    const compacted = generationMessages([assistant("signed", parts), ...longHistory()]);
    expect(compacted[0].parts).toEqual(parts);
  });

  test("native and fallback providers retain their complete original history", (): void => {
    const original = longHistory();
    for (const provider of ["GEMINI", "OPENROUTER", "DEEPSEEK"] as const)
      expect(generationMessages(original, provider)).toEqual(original);
  });

  test("ordered references retain the original results without guessing an entity", (): void => {
    for (const reference of [
      "Pakai proyek pertama pada daftar tadi",
      "Lanjut dari hasil sebelumnya yang paling awal",
      "Use the first project from the earlier list",
    ]) {
      const original = longHistory(reference);
      expect(generationMessages(original)).toEqual(original);
    }
  });

  test("immediate entity follow-ups keep the recent sources and task family after a topic switch", (): void => {
    const messages = [
      ...longHistory("Cek stok gudang QA"),
      assistant("latest-stock", [
        {
          type: "tool-proposeStockCorrection",
          toolCallId: "stock-proposal",
          state: "output-available",
          input: { inventoryLocationId: "chosen-location", quantity: 3 },
          output: { proposal: { locationName: "Gudang QA", quantity: 3 } },
        },
      ]),
      human("follow-up", "Ubah yang tadi menjadi 4 lembar, jangan simpan"),
    ];
    const compacted = generationMessages(messages);
    expect(compacted.at(-1)).toEqual(messages.at(-1));
    expect(compacted.find((message) => message.id === "latest-stock")).toEqual(messages.at(-2));
    expect(callIds(compacted)).not.toContain("read-1");
    expect(
      initialActiveTools(compacted, ["proposeStockCorrection", "getStockCorrectionContext"]),
    ).toEqual(["proposeStockCorrection", "getStockCorrectionContext"]);
  });

  test("does not remove a tool part whose call is retained in another message", (): void => {
    const original = [
      assistant("old-paired", [completedRead("same-call")]),
      ...longHistory(),
      assistant("new-paired", [completedRead("same-call")]),
    ];
    const compacted = generationMessages(original);
    expect(compacted[0]).toEqual(original[0]);
  });

  test("the installed SDK transmits coherent retained call/results with exact receipt values", async (): Promise<void> => {
    const saved = completedRead("saved-proof", {
      isConfirmedByUser: true,
      confirmation: { documentId: "saved-project" },
      amount: "125000000.25",
    });
    const history = [assistant("saved", [saved]), ...longHistory()];
    const sent: LanguageModelV4CallOptions[] = [];
    const model = new MockLanguageModelV4({
      doStream: async (options) => {
        sent.push(options);
        const chunks: LanguageModelV4StreamPart[] = [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "answer" },
          { type: "text-delta", id: "answer", delta: "Baca saldo terbaru sebelum menjawab." },
          { type: "text-end", id: "answer" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "fixture" },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 2, text: 2, reasoning: 0 },
            },
          },
        ];
        return {
          stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }),
        };
      },
    });
    const result = streamText({
      model,
      messages: await convertToModelMessages(generationMessages(history)),
    });
    expect(await result.text).toBe("Baca saldo terbaru sebelum menjawab.");
    expect(sent).toHaveLength(1);
    const packet = JSON.stringify(sent[0].prompt);
    expect(packet).not.toContain("OBSOLETE_READ_1 ");
    expect(packet).toContain("OBSOLETE_READ_8 ");
    expect(packet).toContain("saved-project");
    expect(packet).toContain("125000000.25");
    expect(packet).toContain("Cek saldo aktual rekening QA");
    const calls = sent[0].prompt.flatMap((message) =>
      message.role === "assistant"
        ? message.content.flatMap((part) => (part.type === "tool-call" ? [part.toolCallId] : []))
        : [],
    );
    const results = sent[0].prompt.flatMap((message) =>
      message.role === "tool"
        ? message.content.flatMap((part) => (part.type === "tool-result" ? [part.toolCallId] : []))
        : [],
    );
    expect(calls).toEqual(["saved-proof", "read-8", "read-9", "read-10"]);
    expect(results).toEqual(calls);
    expect(
      history[0].parts.some(
        (part) => isToolUIPart(part) && getToolName(part) === "getBankBalances",
      ),
    ).toBe(true);
  });
});
