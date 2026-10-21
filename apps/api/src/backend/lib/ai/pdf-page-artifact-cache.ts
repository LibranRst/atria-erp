import { createHash } from "node:crypto";
import {
  PDF_RENDER_LIMITS,
  PdfRenderError,
  renderPdfPages,
  type RenderedPdfPages,
} from "./pdf-pages";

type PdfPageRenderer = (bytes: Uint8Array, signal: AbortSignal) => Promise<RenderedPdfPages>;

const MAX_ENTRIES = 2;
const MAX_BYTES = 20 * 1024 * 1024;
const TTL_MS = 5 * 60 * 1000;
const RENDER_VERSION = `complete-pages-v1:${JSON.stringify(PDF_RENDER_LIMITS)}`;

interface PageArtifact {
  readonly pages: RenderedPdfPages;
  readonly retainedBytes: number;
  readonly expiresAt: number;
  readonly expiryTimer: ReturnType<typeof setTimeout>;
}

function copyPages(rendered: RenderedPdfPages): RenderedPdfPages {
  return {
    ...rendered,
    pages: rendered.pages.map((page) => ({ ...page, bytes: new Uint8Array(page.bytes) })),
  };
}

/**
 * Only complete raster artifacts are reusable; authorization remains with the
 * caller's private-file read. Source bytes, not a URL or user assertion, identify
 * an artifact. No OCR text, financial facts, access decisions or failures live here.
 */
export function createImmutablePdfRenderer(
  renderer: PdfPageRenderer,
  now: () => number = Date.now,
): PdfPageRenderer {
  const artifacts = new Map<string, PageArtifact>();
  let retainedBytes = 0;

  function remove(key: string): void {
    const artifact = artifacts.get(key);
    if (!artifact) return;
    retainedBytes -= artifact.retainedBytes;
    clearTimeout(artifact.expiryTimer);
    artifacts.delete(key);
  }

  return async (bytes: Uint8Array, signal: AbortSignal): Promise<RenderedPdfPages> => {
    if (signal.aborted) throw new PdfRenderError("PDF_ABORTED");
    if (bytes.byteLength > PDF_RENDER_LIMITS.sourceBytes)
      throw new PdfRenderError("PDF_INPUT_LIMIT");
    if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
      throw new PdfRenderError("PDF_INPUT_INVALID");

    const timestamp = now();
    for (const [key, artifact] of artifacts) if (artifact.expiresAt <= timestamp) remove(key);
    const key = createHash("sha256").update(RENDER_VERSION).update(bytes).digest("hex");
    const cached = artifacts.get(key);
    if (cached) {
      artifacts.delete(key);
      artifacts.set(key, cached);
      return copyPages(cached.pages);
    }

    // Do not share in-flight work: each miss keeps the renderer's existing BUSY,
    // deadline and cancellation behavior. A cancelled render is never retained.
    const rendered = await renderer(bytes, signal);
    if (signal.aborted) throw new PdfRenderError("PDF_ABORTED");
    const size = rendered.pages.reduce((sum, page) => sum + page.bytes.byteLength, 0);
    if (size > MAX_BYTES) return rendered;
    while (artifacts.size >= MAX_ENTRIES || retainedBytes + size > MAX_BYTES) {
      const oldest = artifacts.keys().next().value;
      if (!oldest) break;
      remove(oldest);
    }
    const expiryTimer = setTimeout((): void => remove(key), TTL_MS);
    expiryTimer.unref();
    artifacts.set(key, {
      pages: copyPages(rendered),
      retainedBytes: size,
      expiresAt: now() + TTL_MS,
      expiryTimer,
    });
    retainedBytes += size;
    return rendered;
  };
}

const renderCachedPages = createImmutablePdfRenderer(renderPdfPages);

/** Call only after the current caller has read and authorized the private source. */
export function renderImmutablePdfPages(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<RenderedPdfPages> {
  return renderCachedPages(bytes, signal);
}
