import { expect, mock } from "bun:test";
import { simulateReadableStream, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { inspect } from "node:util";
import type { ChatStreamInput } from "../chat-stream";

type ModelOptions = Parameters<MockLanguageModelV4["doStream"]>[0];
type ModelResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type ModelPart = ModelResult["stream"] extends ReadableStream<infer Part> ? Part : never;

let chain: readonly string[] = ["DEEPSEEK", "GEMINI"];
let models = new Map<string, MockLanguageModelV4>();
let resolved: string[] = [];
mock.module("@backend/lib/ai/providers", (): Record<string, unknown> => ({
  resolveProviderChain: (): readonly string[] => chain,
  resolveChatModel: (provider: string): MockLanguageModelV4 => {
    resolved.push(provider);
    const model = models.get(provider);
    if (!model) throw new Error("Fixture provider missing.");
    return model;
  },
  isFallbackWorthyError: (): boolean => true,
}));
mock.module("@backend/lib/ai/prompts", (): Record<string, unknown> => ({
  buildSystemPrompt: (): string => "fixture",
}));
mock.module("@backend/lib/ai/tools", (): Record<string, unknown> => ({
  buildAiTools: (): object => ({}),
}));
const { runChatStream } = await import("../chat-stream");

function input(
  onAssistantMessage: ChatStreamInput["onAssistantMessage"],
  signal?: AbortSignal,
): ChatStreamInput {
  return {
    messages: [{ id: "user-message", role: "user", parts: [{ type: "text", text: "halo" }] }],
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
    onAssistantMessage,
    signal,
  };
}

async function consume(
  stream: ReadableStream<UIMessageChunk>,
  onChunk?: (chunk: UIMessageChunk) => void,
): Promise<readonly UIMessageChunk[]> {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
    onChunk?.(value);
  }
}

function successfulModel(): MockLanguageModelV4 {
  const chunks: ModelPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: "Jawaban normal" },
    { type: "text-end", id: "text" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 2, text: 2, reasoning: 0 },
      },
    },
  ];
  return new MockLanguageModelV4({
    doStream: async (): Promise<ModelResult> => ({
      stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }),
    }),
  });
}

async function cancellation(kind: "request" | "deadline", partial = false): Promise<void> {
  resolved = [];
  let providerSignal: AbortSignal | undefined;
  const ready = Promise.withResolvers<void>();
  const partialReceived = Promise.withResolvers<void>();
  const first = new MockLanguageModelV4({
    doStream: async (options: ModelOptions): Promise<ModelResult> => {
      providerSignal = options.abortSignal;
      return {
        stream: new ReadableStream<ModelPart>({
          start(controller): void {
            options.abortSignal?.addEventListener(
              "abort",
              (): void => controller.error(options.abortSignal?.reason),
              { once: true },
            );
            if (partial) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "text-start", id: "partial" });
              controller.enqueue({ type: "text-delta", id: "partial", delta: "Jawaban parsial" });
            }
            ready.resolve();
          },
        }),
      };
    },
  });
  models = new Map([
    ["DEEPSEEK", first],
    ["GEMINI", successfulModel()],
  ]);
  const request = new AbortController();
  const deadline = new AbortController();
  const originalTimeout = AbortSignal.timeout;
  let timeoutMs: number | undefined;
  if (kind === "deadline")
    AbortSignal.timeout = (milliseconds: number): AbortSignal => {
      timeoutMs = milliseconds;
      return deadline.signal;
    };
  let stream: ReadableStream<UIMessageChunk>;
  try {
    stream = runChatStream(
      input(async (): Promise<void> => undefined, kind === "request" ? request.signal : undefined),
    ).stream;
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
  const consumption = consume(stream, (chunk: UIMessageChunk): void => {
    if (chunk.type === "text-delta") partialReceived.resolve();
  });
  await ready.promise;
  if (partial) await partialReceived.promise;
  expect(providerSignal).toBeDefined();
  if (kind === "request") request.abort(new DOMException("client stopped", "AbortError"));
  else deadline.abort(new DOMException("deadline reached", "TimeoutError"));
  const chunks = await consumption;
  expect(providerSignal?.aborted).toBe(true);
  expect(resolved).toEqual(["DEEPSEEK"]);
  if (kind === "deadline") expect(timeoutMs).toBe(45_000);
  if (kind === "deadline")
    expect(
      chunks.some(
        (chunk) => chunk.type === "error" && chunk.errorText.includes("waktu terlalu lama"),
      ),
    ).toBe(true);
  if (partial)
    expect(
      chunks.some((chunk) => chunk.type === "text-delta" && chunk.delta === "Jawaban parsial"),
    ).toBe(true);
}

async function privateProviderError(partial: boolean): Promise<void> {
  const fakeKey = "fixture-provider-secret-key";
  const fakePrompt = "fixture-private-document-prompt";
  const error = new Error(`${fakeKey}: ${fakePrompt}`, {
    cause: { authorization: `Bearer ${fakeKey}`, requestPrompt: fakePrompt },
  });
  const firstTextReceived = Promise.withResolvers<void>();
  const logs: unknown[][] = [];
  const previousConsoleError = console.error;
  const previousChain = chain;
  console.error = (...values: unknown[]): void => {
    logs.push(values);
  };
  chain = partial ? ["DEEPSEEK", "GEMINI"] : ["DEEPSEEK"];
  resolved = [];
  models = new Map([
    [
      "DEEPSEEK",
      new MockLanguageModelV4({
        doStream: async (): Promise<ModelResult> => ({
          stream: new ReadableStream<ModelPart>({
            start(controller: ReadableStreamDefaultController<ModelPart>): void {
              controller.enqueue({ type: "stream-start", warnings: [] });
              const fail = (): void => {
                controller.enqueue({ type: "error", error });
                controller.close();
              };
              if (partial) {
                controller.enqueue({ type: "text-start", id: "private-error" });
                controller.enqueue({
                  type: "text-delta",
                  id: "private-error",
                  delta: "Jawaban parsial aman",
                });
                // Fail only after the UI consumer has received the first text.
                void firstTextReceived.promise.then(fail);
              } else fail();
            },
          }),
        }),
      }),
    ],
    ["GEMINI", successfulModel()],
  ]);
  try {
    const chunks = await consume(
      runChatStream(input(async (): Promise<void> => undefined)).stream,
      (chunk: UIMessageChunk): void => {
        if (chunk.type === "text-delta") firstTextReceived.resolve();
      },
    );
    expect(resolved).toEqual(["DEEPSEEK"]);
    expect(
      chunks.filter((chunk) => chunk.type === "error").map((chunk) => chunk.errorText),
    ).toContain("Maaf, asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi.");
    for (const sensitiveValue of [fakeKey, fakePrompt]) {
      expect(JSON.stringify(chunks)).not.toContain(sensitiveValue);
      expect(inspect(logs, { depth: 10 })).not.toContain(sensitiveValue);
    }
    if (partial) {
      expect(
        chunks.some(
          (chunk) => chunk.type === "text-delta" && chunk.delta === "Jawaban parsial aman",
        ),
      ).toBe(true);
    } else expect(logs).toEqual([["AI chat stream gagal."]]);
  } finally {
    console.error = previousConsoleError;
    chain = previousChain;
  }
}

async function pdfParts(provider: "NINEROUTER" | "GEMINI"): Promise<void> {
  const previousChain = chain;
  let providerPrompt: ModelOptions["prompt"] | undefined;
  chain = [provider];
  resolved = [];
  models = new Map([
    [
      provider,
      new MockLanguageModelV4({
        doStream: async (options: ModelOptions): Promise<ModelResult> => {
          providerPrompt = options.prompt;
          return successfulModel().doStream(options);
        },
      }),
    ],
  ]);
  try {
    await consume(
      runChatStream({
        ...input(async (): Promise<void> => undefined),
        messages: [
          {
            id: "pdf-context",
            role: "user",
            parts: [
              { type: "text", text: "[Data Ekstraksi Dokumen PDF] Synthetic extracted PDF text" },
              {
                type: "file",
                mediaType: "application/pdf",
                filename: "synthetic.pdf",
                url: `data:application/pdf;base64,${Buffer.from("%PDF-synthetic").toString("base64")}`,
              },
              {
                type: "file",
                mediaType: "image/png",
                filename: "synthetic.png",
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5+q3sAAAAASUVORK5CYII=",
              },
            ],
          },
        ],
      }).stream,
    );
    expect(resolved).toEqual([provider]);
    const serialized = JSON.stringify(providerPrompt);
    expect(serialized).toContain("Synthetic extracted PDF text");
    expect(serialized).toContain("image/png");
    expect(serialized.includes("application/pdf")).toBe(provider !== "NINEROUTER");
  } finally {
    chain = previousChain;
  }
}

await cancellation("request");
await cancellation("deadline");
await cancellation("request", true);

resolved = [];
const saved: Array<{
  readonly provider: string;
  readonly text: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}> = [];
const firstFailure: ModelPart[] = [
  { type: "stream-start", warnings: [] },
  { type: "error", error: new Error("fixture provider outage") },
];
models = new Map([
  [
    "DEEPSEEK",
    new MockLanguageModelV4({
      doStream: async (): Promise<ModelResult> => ({
        stream: simulateReadableStream({
          chunks: firstFailure,
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    }),
  ],
  ["GEMINI", successfulModel()],
]);
const chunks = await consume(
  runChatStream(
    input(async (event): Promise<void> => {
      saved.push({
        provider: event.provider,
        text: event.message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(""),
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
      });
    }),
  ).stream,
);
expect(resolved).toEqual(["DEEPSEEK", "GEMINI"]);
expect(
  chunks.some((chunk) => chunk.type === "text-delta" && chunk.delta === "Jawaban normal"),
).toBe(true);
expect(
  saved.some(
    (event) =>
      event.provider === "GEMINI" &&
      event.text === "Jawaban normal" &&
      event.inputTokens === 3 &&
      event.outputTokens === 2,
  ),
).toBe(true);

resolved = [];
chain = ["DEEPSEEK", "GEMINI"];
const stopped = new AbortController();
stopped.abort();
await consume(runChatStream(input(async (): Promise<void> => undefined, stopped.signal)).stream);
expect(resolved).toEqual([]);
await privateProviderError(true);
await privateProviderError(false);
await pdfParts("NINEROUTER");
await pdfParts("GEMINI");
console.info("Chat cancellation/deadline/fallback/persistence/private-error/PDF fixture passed.");
