import { expect, mock } from "bun:test";
import { fileURLToPath } from "node:url";
import { streamText } from "ai";
import { z } from "zod";
import { PDF_RENDER_LIMITS, PdfRenderError, type renderPdfPages } from "../pdf-pages";
import { ChatTiming, type ChatTimingRecord } from "../chat-timing";
import { createOcrTextArtifactCache, createOcrTextCacheKey } from "../ocr-text-artifact-cache";

process.env.AI_CHAT_PROVIDERS = "NINEROUTER";
process.env.AI_APPROVED_PROVIDERS = "NINEROUTER";
process.env.ATRIA_PILOT_REAL_DATA = "true";
process.env.NINEROUTER_API_KEY = "fixture-gateway-key";
process.env.NINEROUTER_BASE_URL = "https://gateway.invalid/v1";
process.env.NINEROUTER_MODEL_ID = "ag/gemini-3.8-flash-high";
process.env.NINEROUTER_REASONING_EFFORT = "high";
// Available alternate credentials must not create an implicit provider fallback.
process.env.DEEPSEEK_API_KEY = "fixture-alternate-key";
process.env.GEMINI_API_KEY = "fixture-alternate-key";
process.env.GEMINI_PAID_DATA_POLICY_CONFIRMED = "false";

const requests: string[] = [];
let expectedModel = "ag/gemini-3.8-flash-high";
let expectedEffort = "high";
let mode:
  "json" | "text" | "invalid" | "error" | "abort" | "stream" | "length" | "golden" | "uncertain" =
  "json";
const goldenText =
  "Tanggal 2026-10-14\nVendor QA\nJumlah 2 lembar\nHarga per satuan Rp 125.000\nTotal Rp 250.000";
const originalFetch = globalThis.fetch;
const started = Promise.withResolvers<void>();

async function mockFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const url = input instanceof Request ? input.url : input.toString();
  expect(url).toBe("https://gateway.invalid/v1/chat/completions");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-gateway-key");
  expect(typeof init?.body).toBe("string");
  const body = String(init?.body);
  requests.push(body);
  const decoded: unknown = JSON.parse(body);
  const selected = z
    .object({
      model: z.string(),
      reasoning_effort: z.string(),
      stream: z.boolean(),
      max_tokens: z.number().optional(),
    })
    .parse(decoded);
  expect(selected.model).toBe(expectedModel);
  expect(selected.reasoning_effort).toBe(expectedEffort);
  expect(selected.stream).toBe(mode === "stream");
  if (mode !== "stream") expect(selected.max_tokens).toBe(8192);
  if (mode === "stream") {
    const chunk = {
      id: "fixture-stream",
      object: "chat.completion.chunk",
      created: 1,
      model: "gemini-3.8-flash",
      choices: [{ index: 0, delta: { content: "stream preserved" }, finish_reason: null }],
    };
    const finish = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
    return new Response(
      `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(finish)}\n\ndata: [DONE]\n\n`,
      { headers: { "content-type": "text/event-stream" } },
    );
  }
  if (mode === "error") throw new Error("fixture-secret-key and private document response");
  if (mode === "abort") {
    started.resolve();
    return new Promise<Response>((_resolve, reject): void => {
      init?.signal?.addEventListener("abort", (): void => reject(init.signal?.reason), {
        once: true,
      });
    });
  }
  const text =
    mode === "json"
      ? '{"amount":12345}'
      : mode === "invalid"
        ? "invalid JSON"
        : mode === "golden"
          ? goldenText
          : mode === "uncertain"
            ? "Jumlah [?]; nominal tidak terbaca."
            : "synthetic document";
  return Response.json({
    id: "fixture-completion",
    object: "chat.completion",
    created: 1,
    model: "gemini-3.8-flash",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: mode === "length" ? "length" : "stop",
      },
    ],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
  });
}
globalThis.fetch = Object.assign(mockFetch, { preconnect: originalFetch.preconnect });
let renderedPdfs = 0;
let oversizedRenderedPage = false;
let renderedPageCount = 1;
const renderPdfFixture: typeof renderPdfPages = async (_bytes, signal) => {
  signal.throwIfAborted();
  renderedPdfs += 1;
  const bytes = oversizedRenderedPage
    ? new Uint8Array(6 * 1024 * 1024)
    : new TextEncoder().encode("synthetic PDF page");
  return {
    total: renderedPageCount,
    pages: Array.from({ length: renderedPageCount }, (_, index) => ({
      pageNumber: index + 1,
      bytes,
      mediaType: "image/png",
      width: 100,
      height: 100,
    })),
    byteLength: bytes.byteLength * renderedPageCount,
  };
};
mock.module(fileURLToPath(new URL("../pdf-pages.ts", import.meta.url)), () => ({
  renderPdfPages: renderPdfFixture,
  PDF_RENDER_LIMITS,
  PdfRenderError,
}));
const { documentModel, requireDocumentProvider } = await import("../document-model");
const schema = {
  type: "object",
  properties: { amount: { type: "number" } },
  required: ["amount"],
  additionalProperties: false,
} as const;

const image = await documentModel.models.generateContent({
  contents: [{ inlineData: { data: "aW1hZ2U=", mimeType: "image/png" } }, "synthetic amount"],
  config: { responseJsonSchema: { ...schema, required: ["amount"] } },
});
expect(image.text).toBe('{"amount":12345}');
expect(image.usageMetadata?.totalTokenCount).toBe(12);
expect(image.modelVersion).toBe("ag/gemini-3.8-flash-high");
expect(image.complete).toBe(true);
expect(requests[0]).toContain('"type":"json_object"');
expect(requests[0]).toContain("Gunakan schema berikut");
expect(requests[0]).toContain("data:image/png;base64,aW1hZ2U=");

mode = "text";
const pdf = await documentModel.models.generateContent({
  contents: [
    {
      inlineData: {
        data: Buffer.from("%PDF-synthetic").toString("base64"),
        mimeType: "application/pdf",
      },
    },
    "synthetic PDF",
  ],
});
expect(pdf.text).toBe("synthetic document");
expect(renderedPdfs).toBe(1);
expect(requests[1]).toContain("data:image/png;base64,");
expect(requests[1]).not.toContain("data:application/pdf");
expect(requests[1]).toContain("Halaman 1 dari 1");

expectedModel = "ag/gemini-3.8-flash-medium";
expectedEffort = "medium";
const timingRecords: ChatTimingRecord[] = [];
const timing = new ChatTiming((record: ChatTimingRecord): void => {
  timingRecords.push(record);
});
const bounded = await documentModel.models.generateContent({
  contents: ["synthetic bounded document"],
  config: { workloadProfile: "bounded", timing },
});
expect(bounded.text).toBe("synthetic document");
expect(bounded.modelVersion).toBe("ag/gemini-3.8-flash-medium");
expect(bounded.complete).toBe(true);
timing.finish("complete");
expect(timingRecords[0]?.modelCalls).toHaveLength(1);
expect(timingRecords[0]?.modelCalls[0]?.model).toBe("gemini-3.8-flash");
expect(timingRecords[0]?.modelCalls[0]?.inputTokens).toBe(8);
expect(JSON.stringify(timingRecords)).not.toContain("synthetic bounded document");
expect(JSON.stringify(timingRecords)).not.toContain("fixture-gateway-key");
expectedModel = "ag/gemini-3.8-flash-high";
expectedEffort = "high";

mode = "golden";
expectedModel = "ag/gemini-3.8-flash-low";
expectedEffort = "low";
const goldenImage = Buffer.from("synthetic golden image source").toString("base64");
const lowImage = await documentModel.models.generateContent({
  contents: [{ inlineData: { data: goldenImage, mimeType: "image/png" } }, "Baca dokumen lengkap."],
  config: { workloadProfile: "simple" },
});
expect(lowImage.text).toBe(goldenText);
expect(lowImage.complete).toBe(true);
expect(lowImage.modelVersion).toBe("ag/gemini-3.8-flash-low");
expect(requests.at(-1)).toContain(`data:image/png;base64,${goldenImage}`);
const lowPdf = await documentModel.models.generateContent({
  contents: [
    {
      inlineData: {
        data: Buffer.from("%PDF-low-one-page").toString("base64"),
        mimeType: "application/pdf",
      },
    },
    "Baca dokumen lengkap.",
  ],
  config: { workloadProfile: "simple" },
});
expect(lowPdf.text).toBe(goldenText);
expect(lowPdf.complete).toBe(true);
expect(lowPdf.modelVersion).toBe("ag/gemini-3.8-flash-low");
expect(requests.at(-1)).toContain("Halaman 1 dari 1");

mode = "uncertain";
const uncertain = await documentModel.models.generateContent({
  contents: [
    { inlineData: { data: goldenImage, mimeType: "image/png" } },
    "Baca semua nilai tanpa menebak.",
  ],
  config: { workloadProfile: "simple" },
});
expect(uncertain.text).toContain("[?]");
const uncertainCache = createOcrTextArtifactCache();
const uncertainKey = createOcrTextCacheKey({
  actorScope: "fixture-owner",
  mimeType: "image/png",
  bytes: Buffer.from(goldenImage, "base64"),
  extractorVersion: "fixture-full",
  modelSignature: "NINEROUTER/low",
});
expect(
  uncertainCache.set(
    uncertainKey,
    "fixture-owner",
    { status: uncertain.complete ? "complete" : "incomplete", text: uncertain.text },
    AbortSignal.timeout(1000),
  ),
).toBe(false);
expect(
  uncertainCache.get(uncertainKey, "fixture-owner", AbortSignal.timeout(1000)),
).toBeUndefined();

mode = "golden";
expectedModel = "ag/gemini-3.8-flash-high";
expectedEffort = "high";
renderedPageCount = 2;
const multiPage = await documentModel.models.generateContent({
  contents: [
    {
      inlineData: {
        data: Buffer.from("%PDF-low-request-two-pages").toString("base64"),
        mimeType: "application/pdf",
      },
    },
    "Baca dokumen lengkap.",
  ],
  config: { workloadProfile: "simple" },
});
expect(multiPage.text).toBe(goldenText);
expect(multiPage.complete).toBe(true);
expect(multiPage.modelVersion).toBe("ag/gemini-3.8-flash-high");
expect(requests.at(-1)).toContain("Halaman 1 dari 2");
expect(requests.at(-1)).toContain("Halaman 2 dari 2");
renderedPageCount = 1;
const multiImage = await documentModel.models.generateContent({
  contents: [
    { inlineData: { data: goldenImage, mimeType: "image/png" } },
    {
      inlineData: {
        data: Buffer.from("synthetic second page").toString("base64"),
        mimeType: "image/png",
      },
    },
    "Baca seluruh gambar lengkap.",
  ],
  config: { workloadProfile: "simple" },
});
expect(multiImage.text).toBe(goldenText);
expect(multiImage.complete).toBe(true);
expect(multiImage.modelVersion).toBe("ag/gemini-3.8-flash-high");
expect(requests.at(-1)).toContain(goldenImage);
expect(requests.at(-1)).toContain(Buffer.from("synthetic second page").toString("base64"));
const beforeDeniedProvider = requests.length;

process.env.AI_APPROVED_PROVIDERS = "";
expect((): void => {
  requireDocumentProvider();
}).toThrow("disetujui");
expect(requests).toHaveLength(beforeDeniedProvider);
process.env.AI_APPROVED_PROVIDERS = "NINEROUTER";

mode = "length";
const unfinished = await documentModel.models.generateContent({
  contents: ["synthetic unfinished document"],
});
expect(unfinished.text).toBe("synthetic document");
expect(unfinished.complete).toBe(false);

mode = "invalid";
await expect(
  documentModel.models.generateContent({
    contents: ["synthetic invalid object"],
    config: { responseJsonSchema: { ...schema, required: ["amount"] } },
  }),
).rejects.toThrow("Penyedia AI gagal membaca dokumen");

mode = "error";
const beforeFailure = requests.length;
await expect(
  documentModel.models.generateContent({ contents: ["synthetic error"] }),
).rejects.toThrow("Penyedia AI gagal membaca dokumen");
expect(requests).toHaveLength(beforeFailure + 1);

const alreadyCancelled = new AbortController();
alreadyCancelled.abort(new Error("fixture-secret-key"));
await expect(
  documentModel.models.generateContent({
    contents: ["synthetic cancelled"],
    config: { abortSignal: alreadyCancelled.signal },
  }),
).rejects.toThrow("Permintaan AI dibatalkan");
expect(requests).toHaveLength(beforeFailure + 1);

mode = "abort";
const controller = new AbortController();
const pending = documentModel.models.generateContent({
  contents: ["synthetic cancellation"],
  config: { abortSignal: controller.signal },
});
await started.promise;
controller.abort(new Error("fixture-secret-key"));
await expect(pending).rejects.toThrow("Permintaan AI dibatalkan");
expect(requests).toHaveLength(beforeFailure + 2);
mode = "stream";
const { resolveChatModel } = await import("../providers");
const stream = streamText({
  model: resolveChatModel("NINEROUTER"),
  prompt: "synthetic stream",
  maxRetries: 0,
});
let streamedText = "";
for await (const delta of stream.textStream) streamedText += delta;
expect(streamedText).toBe("stream preserved");
oversizedRenderedPage = true;
const beforeOversizedRequest = requests.length;
await expect(
  documentModel.models.generateContent({
    contents: [
      {
        inlineData: {
          data: Buffer.from("%PDF-oversized").toString("base64"),
          mimeType: "application/pdf",
        },
      },
      {
        inlineData: {
          data: Buffer.from("%PDF-oversized").toString("base64"),
          mimeType: "application/pdf",
        },
      },
    ],
  }),
).rejects.toThrow("Ukuran total dokumen AI terlalu besar");
expect(requests).toHaveLength(beforeOversizedRequest);
console.log("document model checks passed");
