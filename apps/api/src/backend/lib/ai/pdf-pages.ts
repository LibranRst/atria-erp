import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const PDF_RENDER_LIMITS = Object.freeze({
  sourceBytes: 10 * 1024 * 1024,
  pages: 5,
  width: 1200,
  height: 2400,
  imageBytes: 10 * 1024 * 1024,
  outputBytes: 14 * 1024 * 1024,
  deadlineMs: 15_000,
});

const failureCodeSchema = z.enum([
  "PDF_INPUT_INVALID",
  "PDF_INPUT_LIMIT",
  "PDF_PAGE_LIMIT",
  "PDF_IMAGE_LIMIT",
  "PDF_ABORTED",
  "PDF_TIMEOUT",
  "PDF_BUSY",
  "PDF_RENDER_FAILED",
]);

export type PdfRenderFailureCode = z.infer<typeof failureCodeSchema>;

export class PdfRenderError extends Error {
  constructor(readonly code: PdfRenderFailureCode) {
    const message =
      code === "PDF_PAGE_LIMIT"
        ? "PDF maksimal 5 halaman. Pisahkan dokumen sebelum mencoba lagi."
        : code === "PDF_INPUT_LIMIT"
          ? "Ukuran PDF maksimal 10 MB. Gunakan dokumen yang lebih kecil."
          : code === "PDF_IMAGE_LIMIT"
            ? "Hasil pemrosesan PDF terlalu besar. Pisahkan dokumen atau gunakan gambar."
            : code === "PDF_BUSY"
              ? "PDF lain sedang diproses. Coba lagi sebentar."
              : code === "PDF_ABORTED"
                ? "Pemrosesan PDF dibatalkan."
                : code === "PDF_TIMEOUT"
                  ? "Pemrosesan PDF melewati batas waktu. Coba gunakan gambar dokumen."
                  : "PDF tidak dapat diproses. Coba lagi atau gunakan gambar dokumen.";
    super(message);
    this.name = "PdfRenderError";
  }
}

export interface RenderedPdfPage {
  readonly pageNumber: number;
  readonly bytes: Uint8Array;
  readonly mediaType: "image/png";
  readonly width: number;
  readonly height: number;
}

export interface RenderedPdfPages {
  readonly total: number;
  readonly pages: readonly RenderedPdfPage[];
  readonly byteLength: number;
}

const workerResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    total: z.number().int().min(1).max(PDF_RENDER_LIMITS.pages),
    byteLength: z.number().int().min(1).max(PDF_RENDER_LIMITS.imageBytes),
    pages: z
      .array(
        z.object({
          pageNumber: z.number().int().min(1).max(PDF_RENDER_LIMITS.pages),
          width: z.number().int().min(1).max(PDF_RENDER_LIMITS.width),
          height: z.number().int().min(1).max(PDF_RENDER_LIMITS.height),
          base64: z.string().min(1),
        }),
      )
      .min(1)
      .max(PDF_RENDER_LIMITS.pages),
  }),
  z.object({ success: z.literal(false), code: failureCodeSchema }),
]);

let activeRenderer = false;

function workerPath(): string {
  const candidates = [
    // Development source, then the source asset copied next to a production dist bundle.
    new URL("../../../runtime/pdf-render-worker.ts", import.meta.url),
    new URL("../src/runtime/pdf-render-worker.ts", import.meta.url),
    new URL("./pdf-render-worker.js", import.meta.url),
  ];
  const selected = candidates.find((candidate) => existsSync(fileURLToPath(candidate)));
  if (!selected) throw new PdfRenderError("PDF_RENDER_FAILED");
  return fileURLToPath(selected);
}

async function boundedOutput(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > PDF_RENDER_LIMITS.outputBytes) throw new PdfRenderError("PDF_IMAGE_LIMIT");
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function decodeResult(raw: string): RenderedPdfPages {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PdfRenderError("PDF_RENDER_FAILED");
  }
  const result = workerResultSchema.safeParse(parsed);
  if (!result.success) throw new PdfRenderError("PDF_RENDER_FAILED");
  if (!result.data.success) throw new PdfRenderError(result.data.code);
  if (result.data.pages.length !== result.data.total) throw new PdfRenderError("PDF_RENDER_FAILED");
  let byteLength = 0;
  const pages = result.data.pages.map((page, index): RenderedPdfPage => {
    const bytes = Buffer.from(page.base64, "base64");
    if (
      page.pageNumber !== index + 1 ||
      bytes.byteLength < 24 ||
      bytes.toString("base64") !== page.base64 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.readUInt32BE(16) !== page.width ||
      bytes.readUInt32BE(20) !== page.height
    )
      throw new PdfRenderError("PDF_RENDER_FAILED");
    byteLength += bytes.byteLength;
    if (byteLength > PDF_RENDER_LIMITS.imageBytes) throw new PdfRenderError("PDF_IMAGE_LIMIT");
    return {
      pageNumber: page.pageNumber,
      bytes,
      mediaType: "image/png",
      width: page.width,
      height: page.height,
    };
  });
  if (byteLength !== result.data.byteLength) throw new PdfRenderError("PDF_RENDER_FAILED");
  return { total: result.data.total, pages, byteLength };
}

/** Local PDF bytes become complete bounded page images, with no provider or database access. */
export async function renderPdfPages(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<RenderedPdfPages> {
  if (signal.aborted) throw new PdfRenderError("PDF_ABORTED");
  if (bytes.byteLength > PDF_RENDER_LIMITS.sourceBytes) throw new PdfRenderError("PDF_INPUT_LIMIT");
  if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new PdfRenderError("PDF_INPUT_INVALID");
  }
  if (activeRenderer) throw new PdfRenderError("PDF_BUSY");
  activeRenderer = true;
  let child: Bun.Subprocess<Uint8Array, "pipe", "ignore"> | undefined;
  let aborted = false;
  let timedOut = false;
  const stop = (): void => {
    if (child && child.exitCode === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
  };
  const onAbort = (): void => {
    aborted = true;
    stop();
  };
  const timer = setTimeout((): void => {
    timedOut = true;
    stop();
  }, PDF_RENDER_LIMITS.deadlineMs);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    child = Bun.spawn({
      cmd: [process.execPath, "--no-env-file", "--smol", workerPath()],
      stdin: new Uint8Array(bytes),
      stdout: "pipe",
      stderr: "ignore",
      // Do not forward database, auth, storage, gateway or developer environment values.
      env: { NODE_ENV: "production", TZ: "UTC", LANG: "C.UTF-8" },
    });
    if (signal.aborted) onAbort();
    const [raw, exitCode] = await Promise.all([boundedOutput(child.stdout), child.exited]);
    if (aborted) throw new PdfRenderError("PDF_ABORTED");
    if (timedOut) throw new PdfRenderError("PDF_TIMEOUT");
    if (exitCode !== 0) throw new PdfRenderError("PDF_RENDER_FAILED");
    return decodeResult(raw);
  } catch (error: unknown) {
    if (aborted || signal.aborted) throw new PdfRenderError("PDF_ABORTED");
    if (timedOut) throw new PdfRenderError("PDF_TIMEOUT");
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError("PDF_RENDER_FAILED");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    stop();
    if (child) await child.exited.catch((): void => undefined);
    activeRenderer = false;
  }
}
