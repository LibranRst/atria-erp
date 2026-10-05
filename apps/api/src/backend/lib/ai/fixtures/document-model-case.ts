import { expect, mock } from "bun:test";
import { fileURLToPath } from "node:url";
import { streamText } from "ai";
import { z } from "zod";
import type { renderPdfPages } from "../pdf-pages";

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
let mode: "json" | "text" | "invalid" | "error" | "abort" | "stream" = "json";
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
    .object({ model: z.string(), reasoning_effort: z.string(), stream: z.boolean() })
    .parse(decoded);
  expect(selected.model).toBe("ag/gemini-3.8-flash-high");
  expect(selected.reasoning_effort).toBe("high");
  expect(selected.stream).toBe(mode === "stream");
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
        : "synthetic document";
  return Response.json({
    id: "fixture-completion",
    object: "chat.completion",
    created: 1,
    model: "gemini-3.8-flash",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
  });
}
globalThis.fetch = Object.assign(mockFetch, { preconnect: originalFetch.preconnect });
let renderedPdfs = 0;
let oversizedRenderedPage = false;
const renderPdfFixture: typeof renderPdfPages = async (_bytes, signal) => {
  signal.throwIfAborted();
  renderedPdfs += 1;
  const bytes = oversizedRenderedPage
    ? new Uint8Array(6 * 1024 * 1024)
    : new TextEncoder().encode("synthetic PDF page");
  return {
    total: 1,
    pages: [{ pageNumber: 1, bytes, mediaType: "image/png", width: 100, height: 100 }],
    byteLength: bytes.byteLength,
  };
};
mock.module(fileURLToPath(new URL("../pdf-pages.ts", import.meta.url)), () => ({
  renderPdfPages: renderPdfFixture,
  PDF_RENDER_LIMITS: { imageBytes: 10 * 1024 * 1024 },
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
expect(requests[0]).toContain('"type":"json_object"');
expect(requests[0]).toContain("Gunakan schema berikut");
expect(requests[0]).toContain("data:image/png;base64,aW1hZ2U=");

mode = "text";
const pdf = await documentModel.models.generateContent({
  contents: [{ inlineData: { data: "JVBERg==", mimeType: "application/pdf" } }, "synthetic PDF"],
});
expect(pdf.text).toBe("synthetic document");
expect(renderedPdfs).toBe(1);
expect(requests[1]).toContain("data:image/png;base64,");
expect(requests[1]).not.toContain("data:application/pdf");
expect(requests[1]).toContain("Halaman 1 dari 1");

process.env.AI_APPROVED_PROVIDERS = "";
expect((): void => {
  requireDocumentProvider();
}).toThrow("disetujui");
expect(requests).toHaveLength(2);
process.env.AI_APPROVED_PROVIDERS = "NINEROUTER";

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
      { inlineData: { data: "JVBERg==", mimeType: "application/pdf" } },
      { inlineData: { data: "JVBERg==", mimeType: "application/pdf" } },
    ],
  }),
).rejects.toThrow("Ukuran total dokumen AI terlalu besar");
expect(requests).toHaveLength(beforeOversizedRequest);
console.log("document model checks passed");
