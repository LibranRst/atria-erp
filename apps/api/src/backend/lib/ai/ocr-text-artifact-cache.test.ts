import { describe, expect, it } from "bun:test";
import {
  createOcrTextArtifactCache,
  createOcrTextCacheKey,
  type OcrTextSource,
  type OcrTextArtifact,
} from "./ocr-text-artifact-cache";

const actorScope = "synthetic-tenant:synthetic-owner";
function source(overrides: Partial<OcrTextSource> = {}): OcrTextSource {
  return {
    actorScope,
    bytes: new TextEncoder().encode("synthetic immutable image"),
    mimeType: "image/png",
    extractorVersion: "full-ocr-v2",
    modelSignature: "NINEROUTER/ag/gemini-3.8-flash-medium/bounded/https://gateway.invalid/v1",
    ...overrides,
  };
}

describe("owned immutable OCR text artifacts", (): void => {
  it("returns only completed raw text in the same actual actor scope", (): void => {
    const cache = createOcrTextArtifactCache();
    const key = createOcrTextCacheKey(source());
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    const text = "Invoice QA\n2 lembar\nTotal Rp 250.000";
    expect(
      cache.set(key, actorScope, { status: "complete", text }, AbortSignal.timeout(1000)),
    ).toBe(true);
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBe(text);
    expect(cache.get(key, "different-owner", AbortSignal.timeout(1000))).toBeUndefined();
    expect(
      cache.get(
        { ...key, actorScope: "different-owner" },
        "different-owner",
        AbortSignal.timeout(1000),
      ),
    ).toBeUndefined();
    expect(
      cache.set(key, "different-owner", { status: "complete", text }, AbortSignal.timeout(1000)),
    ).toBe(false);
    expect(
      cache.get(
        createOcrTextCacheKey(source({ actorScope: "different-owner" })),
        "different-owner",
        AbortSignal.timeout(1000),
      ),
    ).toBeUndefined();
    expect(cache.get(key, "", AbortSignal.timeout(1000))).toBeUndefined();
  });

  it("invalidates identity when source bytes, MIME, extractor or model configuration differs", (): void => {
    const cache = createOcrTextArtifactCache();
    const key = createOcrTextCacheKey(source());
    cache.set(
      key,
      actorScope,
      { status: "complete", text: "Synthetic complete source" },
      AbortSignal.timeout(1000),
    );
    const changes: Partial<OcrTextSource>[] = [
      { bytes: new TextEncoder().encode("changed immutable image") },
      { mimeType: "image/jpeg" },
      { extractorVersion: "full-ocr-v3" },
      { modelSignature: "NINEROUTER/ag/gemini-3.8-flash-high/complex/https://gateway.invalid/v1" },
      {
        modelSignature:
          "NINEROUTER/ag/gemini-3.8-flash-medium/bounded/https://other-gateway.invalid/v1",
      },
    ];
    for (const change of changes) {
      const changed = createOcrTextCacheKey(source(change));
      expect(changed.digest).not.toBe(key.digest);
      expect(cache.get(changed, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    }
    expect(createOcrTextCacheKey(source()).digest).toBe(key.digest);
  });

  it("expires after five minutes without extending expiry when read", (): void => {
    let timestamp = 1000;
    const cache = createOcrTextArtifactCache((): number => timestamp);
    const key = createOcrTextCacheKey(source());
    cache.set(
      key,
      actorScope,
      { status: "complete", text: "Synthetic source" },
      AbortSignal.timeout(1000),
    );
    timestamp += 5 * 60 * 1000 - 1;
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBe("Synthetic source");
    timestamp++;
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
  });

  it("keeps only sixteen artifacts in LRU order", (): void => {
    const cache = createOcrTextArtifactCache();
    const keys = Array.from({ length: 17 }, (_, index) =>
      createOcrTextCacheKey(source({ bytes: new TextEncoder().encode(`source-${index}`) })),
    );
    for (const key of keys.slice(0, 16))
      cache.set(
        key,
        actorScope,
        { status: "complete", text: "Synthetic source" },
        AbortSignal.timeout(1000),
      );
    expect(cache.get(keys[0], actorScope, AbortSignal.timeout(1000))).toBe("Synthetic source");
    cache.set(
      keys[16],
      actorScope,
      { status: "complete", text: "Synthetic source" },
      AbortSignal.timeout(1000),
    );
    expect(cache.get(keys[1], actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    expect(cache.get(keys[0], actorScope, AbortSignal.timeout(1000))).toBe("Synthetic source");
    expect(cache.get(keys[16], actorScope, AbortSignal.timeout(1000))).toBe("Synthetic source");
  });

  it("bounds aggregate UTF-8 bytes to two MiB instead of counting characters", (): void => {
    const cache = createOcrTextArtifactCache();
    const first = createOcrTextCacheKey(source());
    const second = createOcrTextCacheKey(source({ bytes: new Uint8Array([2]) }));
    const text = "x".repeat(1024 * 1024 + 1);
    expect(
      cache.set(first, actorScope, { status: "complete", text }, AbortSignal.timeout(1000)),
    ).toBe(true);
    expect(
      cache.set(second, actorScope, { status: "complete", text }, AbortSignal.timeout(1000)),
    ).toBe(true);
    expect(cache.get(first, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    expect(cache.get(second, actorScope, AbortSignal.timeout(1000))).toBe(text);
    expect(
      cache.set(
        first,
        actorScope,
        { status: "complete", text: "é".repeat(1024 * 1024 + 1) },
        AbortSignal.timeout(1000),
      ),
    ).toBe(false);
    expect(cache.get(first, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
  });

  it("never retains failed, unfinished, blank or uncertain extraction results", (): void => {
    const cache = createOcrTextArtifactCache();
    const key = createOcrTextCacheKey(source());
    const invalid: OcrTextArtifact[] = [
      { status: "failed", text: "Synthetic failure" },
      { status: "incomplete", text: "Readable beginning only" },
      { status: "uncertain", text: "Readable fields" },
      { status: "complete", text: "  \n\t " },
      { status: "complete" },
      { status: "complete", text: "Harga [?]" },
      { status: "complete", text: "Bagian tanggal tidak terbaca." },
      { status: "complete", text: "Nilai ambigu." },
      { status: "complete", text: "PREVIEW TIDAK LENGKAP" },
      { status: "complete", text: "Some text unreadable." },
    ];
    for (const artifact of invalid) {
      cache.set(
        key,
        actorScope,
        { status: "complete", text: "Previous complete source" },
        AbortSignal.timeout(1000),
      );
      expect(cache.set(key, actorScope, artifact, AbortSignal.timeout(1000))).toBe(false);
      expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    }
  });

  it("checks abort on hits and writes and exposes no in-flight result before successful set", (): void => {
    const cache = createOcrTextArtifactCache();
    const key = createOcrTextCacheKey(source());
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    expect(
      cache.set(
        key,
        actorScope,
        { status: "complete", text: "Synthetic source" },
        AbortSignal.abort(),
      ),
    ).toBe(false);
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBeUndefined();
    cache.set(
      key,
      actorScope,
      { status: "complete", text: "Synthetic source" },
      AbortSignal.timeout(1000),
    );
    expect(cache.get(key, actorScope, AbortSignal.abort())).toBeUndefined();
    expect(cache.get(key, actorScope, AbortSignal.timeout(1000))).toBe("Synthetic source");
  });
});
