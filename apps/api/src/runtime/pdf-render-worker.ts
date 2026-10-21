import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { PDFParse } from "pdf-parse";
import {
  PDF_RENDER_LIMITS,
  PdfRenderError,
  type PdfRenderFailureCode,
} from "../backend/lib/ai/pdf-pages";

interface WorkerPage {
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
  readonly base64: string;
}

type WorkerResult =
  | {
      readonly success: true;
      readonly total: number;
      readonly byteLength: number;
      readonly pages: readonly WorkerPage[];
    }
  | { readonly success: false; readonly code: PdfRenderFailureCode };

async function render(): Promise<WorkerResult> {
  let parser: PDFParse | undefined;
  try {
    const allowedEnvironment = new Set(["NODE_ENV", "TZ", "LANG"]);
    if (Object.keys(process.env).some((key) => !allowedEnvironment.has(key))) {
      throw new PdfRenderError("PDF_RENDER_FAILED");
    }
    // This override is isolated to the renderer process; PDF-linked URLs cannot be fetched.
    const denyNetwork = async (): Promise<Response> => {
      throw new Error("Network unavailable");
    };
    globalThis.fetch = Object.assign(denyNetwork, {
      preconnect: (): void => {
        throw new Error("Network unavailable");
      },
    });
    const bytes = new Uint8Array(await Bun.stdin.arrayBuffer());
    if (bytes.byteLength > PDF_RENDER_LIMITS.sourceBytes)
      throw new PdfRenderError("PDF_INPUT_LIMIT");
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
      throw new PdfRenderError("PDF_INPUT_INVALID");
    const require = createRequire(import.meta.url);
    const parserRequire = createRequire(require.resolve("pdf-parse"));
    const pdfJsDirectory = dirname(parserRequire.resolve("pdfjs-dist/package.json"));
    parser = new PDFParse({
      data: bytes,
      standardFontDataUrl: join(pdfJsDirectory, "standard_fonts") + sep,
      cMapUrl: join(pdfJsDirectory, "cmaps") + sep,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
      useWasm: false,
      enableXfa: false,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      stopAtErrors: true,
      verbosity: 0,
    });
    const info = await parser.getInfo();
    if (!Number.isInteger(info.total) || info.total < 1 || info.total > PDF_RENDER_LIMITS.pages) {
      throw new PdfRenderError("PDF_PAGE_LIMIT");
    }
    const details = await parser.getInfo({ parsePageInfo: true });
    if (details.pages.length !== info.total) throw new PdfRenderError("PDF_RENDER_FAILED");
    const pages: WorkerPage[] = [];
    let byteLength = 0;
    for (const page of details.pages) {
      if (
        !Number.isFinite(page.width) ||
        !Number.isFinite(page.height) ||
        page.width <= 0 ||
        page.height <= 0
      ) {
        throw new PdfRenderError("PDF_RENDER_FAILED");
      }
      const desiredWidth = Math.floor(
        Math.min(PDF_RENDER_LIMITS.width, (PDF_RENDER_LIMITS.height * page.width) / page.height),
      );
      if (desiredWidth < 1) throw new PdfRenderError("PDF_RENDER_FAILED");
      const result = await parser.getScreenshot({
        partial: [page.pageNumber],
        desiredWidth,
        imageBuffer: true,
        imageDataUrl: false,
      });
      const image = result.pages[0];
      if (
        !image ||
        result.pages.length !== 1 ||
        image.pageNumber !== page.pageNumber ||
        image.data.byteLength < 24
      ) {
        throw new PdfRenderError("PDF_RENDER_FAILED");
      }
      const png = Buffer.from(image.data);
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      if (
        width < 1 ||
        height < 1 ||
        width > PDF_RENDER_LIMITS.width ||
        height > PDF_RENDER_LIMITS.height
      ) {
        throw new PdfRenderError("PDF_RENDER_FAILED");
      }
      byteLength += png.byteLength;
      if (byteLength > PDF_RENDER_LIMITS.imageBytes) throw new PdfRenderError("PDF_IMAGE_LIMIT");
      pages.push({ pageNumber: page.pageNumber, width, height, base64: png.toString("base64") });
    }
    if (pages.length !== info.total) throw new PdfRenderError("PDF_RENDER_FAILED");
    return { success: true, total: info.total, pages, byteLength };
  } catch (error: unknown) {
    return {
      success: false,
      code: error instanceof PdfRenderError ? error.code : "PDF_RENDER_FAILED",
    };
  } finally {
    await parser?.destroy().catch((): void => undefined);
  }
}

await Bun.write(Bun.stdout, JSON.stringify(await render()));
