import { describe, expect, it } from "bun:test";
import { createImmutablePdfRenderer } from "./pdf-page-artifact-cache";
import { PDF_RENDER_LIMITS, PdfRenderError, type RenderedPdfPages } from "./pdf-pages";

function source(identity: string): Uint8Array {
  return new TextEncoder().encode(`%PDF-${identity}`);
}

function pages(size = 4): RenderedPdfPages {
  return {
    total: 2,
    byteLength: size,
    pages: [
      {
        pageNumber: 1,
        bytes: new Uint8Array(Math.ceil(size / 2)).fill(11),
        mediaType: "image/png",
        width: 100,
        height: 200,
      },
      {
        pageNumber: 2,
        bytes: new Uint8Array(Math.floor(size / 2)).fill(22),
        mediaType: "image/png",
        width: 100,
        height: 200,
      },
    ],
  };
}

describe("bounded complete PDF raster artifacts", (): void => {
  it("reuses identical bytes and preserves every page without exposing cached byte arrays", async (): Promise<void> => {
    let renders = 0;
    const cached = createImmutablePdfRenderer(
      async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
        renders++;
        return pages();
      },
    );
    const first = await cached(source("one"), AbortSignal.timeout(1000));
    const firstPage = first.pages[0];
    if (!firstPage) throw new Error("Synthetic page missing");
    firstPage.bytes[0] = 99;
    const second = await cached(source("one"), AbortSignal.timeout(1000));
    expect(renders).toBe(1);
    expect(second.total).toBe(2);
    expect(second.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(second.pages[0]?.bytes[0]).toBe(11);
    const secondPage = second.pages[1];
    if (!secondPage) throw new Error("Synthetic page missing");
    secondPage.bytes[0] = 99;
    const third = await cached(source("one"), AbortSignal.timeout(1000));
    expect(third.pages[1]?.bytes[0]).toBe(22);
    await cached(source("changed"), AbortSignal.timeout(1000));
    expect(renders).toBe(2);
  });

  it("expires at five minutes and retains only the two most recently used artifacts", async (): Promise<void> => {
    let timestamp = 0;
    let renders = 0;
    const cached = createImmutablePdfRenderer(
      async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
        renders++;
        return pages();
      },
      (): number => timestamp,
    );
    await cached(source("A"), AbortSignal.timeout(1000));
    await cached(source("B"), AbortSignal.timeout(1000));
    await cached(source("A"), AbortSignal.timeout(1000));
    await cached(source("C"), AbortSignal.timeout(1000));
    await cached(source("B"), AbortSignal.timeout(1000));
    expect(renders).toBe(4);
    timestamp = 5 * 60 * 1000;
    await cached(source("B"), AbortSignal.timeout(1000));
    expect(renders).toBe(5);
  });

  it("does not retain an artifact over the aggregate byte budget", async (): Promise<void> => {
    let renders = 0;
    const cached = createImmutablePdfRenderer(
      async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
        renders++;
        // A synthetic renderer tests the retention boundary independently from
        // the production renderer's stricter per-document image limit.
        return pages(20 * 1024 * 1024 + 1);
      },
    );
    await cached(source("large"), AbortSignal.timeout(1000));
    await cached(source("large"), AbortSignal.timeout(1000));
    expect(renders).toBe(2);
  });

  it("never caches render failures or renders cancelled before completion", async (): Promise<void> => {
    let renders = 0;
    const cancelled = new AbortController();
    const cached = createImmutablePdfRenderer(
      async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
        renders++;
        if (renders === 1) throw new PdfRenderError("PDF_RENDER_FAILED");
        if (renders === 2) cancelled.abort();
        return pages();
      },
    );
    await expect(cached(source("failure"), AbortSignal.timeout(1000))).rejects.toThrow(
      "PDF tidak dapat diproses",
    );
    await expect(cached(source("failure"), cancelled.signal)).rejects.toThrow(
      "Pemrosesan PDF dibatalkan",
    );
    await cached(source("failure"), AbortSignal.timeout(1000));
    await cached(source("failure"), AbortSignal.timeout(1000));
    expect(renders).toBe(3);
  });

  it("checks input limits and cancellation even when the artifact was cached", async (): Promise<void> => {
    let renders = 0;
    const cached = createImmutablePdfRenderer(
      async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
        renders++;
        return pages();
      },
    );
    await cached(source("hit"), AbortSignal.timeout(1000));
    await expect(cached(source("hit"), AbortSignal.abort())).rejects.toThrow(
      "Pemrosesan PDF dibatalkan",
    );
    await expect(cached(new Uint8Array(3), AbortSignal.timeout(1000))).rejects.toThrow(
      "PDF tidak dapat diproses",
    );
    await expect(
      cached(new Uint8Array(PDF_RENDER_LIMITS.sourceBytes + 1), AbortSignal.timeout(1000)),
    ).rejects.toThrow("Ukuran PDF maksimal 10 MB");
    expect(renders).toBe(1);
  });

  it("preserves in-flight BUSY behavior instead of sharing another request's cancellation", async (): Promise<void> => {
    const pending = Promise.withResolvers<RenderedPdfPages>();
    let active = false;
    let renders = 0;
    const cached = createImmutablePdfRenderer(
      async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
        if (active) throw new PdfRenderError("PDF_BUSY");
        active = true;
        renders++;
        try {
          return await pending.promise;
        } finally {
          active = false;
        }
      },
    );
    const first = cached(source("concurrent"), AbortSignal.timeout(1000));
    await expect(cached(source("concurrent"), AbortSignal.timeout(1000))).rejects.toThrow(
      "PDF lain sedang diproses",
    );
    pending.resolve(pages());
    await first;
    await cached(source("concurrent"), AbortSignal.timeout(1000));
    expect(renders).toBe(1);
  });
});
