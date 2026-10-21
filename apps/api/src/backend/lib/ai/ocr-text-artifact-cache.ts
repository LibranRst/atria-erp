import { createHash } from "node:crypto";

export interface OcrTextSource {
  readonly actorScope: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly extractorVersion: string;
  /** Selected approved provider/model/profile and endpoint, without credentials. */
  readonly modelSignature: string;
}

export interface OcrTextCacheKey {
  readonly actorScope: string;
  readonly digest: string;
}

export interface OcrTextArtifact {
  readonly status: "complete" | "uncertain" | "incomplete" | "failed";
  readonly text?: string;
}

export interface OcrTextArtifactCache {
  get(key: OcrTextCacheKey, actorScope: string, signal: AbortSignal): string | undefined;
  set(
    key: OcrTextCacheKey,
    actorScope: string,
    artifact: OcrTextArtifact,
    signal: AbortSignal,
  ): boolean;
}

const CACHE_VERSION = "owned-immutable-ocr-v1";
const MAX_ENTRIES = 16;
const MAX_BYTES = 2 * 1024 * 1024;
const TTL_MS = 5 * 60 * 1000;
// Conservative: an uncertain reading may run again, but never becomes a cached
// complete source. Callers must also supply the actual extraction completion status.
const UNCERTAIN_OR_INCOMPLETE =
  /\[\?\]|\b(?:ambigu\w*|uncertain\w*|incomplete|unreadable|illegible|unclear|partially|missing)\b|\b(?:cannot|could not|unable to)\s+(?:read|extract)\b|\b(?:tidak|belum|kurang)\s+(?:terbaca|jelas|lengkap)|\b(?:belum berhasil|gagal membaca|tidak dapat dibaca|tidak bisa dibaca|halaman hilang)\b/i;

interface CachedText {
  readonly text: string;
  readonly bytes: number;
  readonly expiresAt: number;
  readonly expiryTimer: ReturnType<typeof setTimeout>;
}

/** Identity comes only from bytes obtained by the caller's current authorized read. */
export function createOcrTextCacheKey(source: OcrTextSource): OcrTextCacheKey {
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        CACHE_VERSION,
        source.actorScope,
        source.mimeType,
        source.extractorVersion,
        source.modelSignature,
      ]),
    )
    .update(source.bytes)
    .digest("hex");
  return Object.freeze({ actorScope: source.actorScope, digest });
}

/** Successful immutable raw OCR only; no file URLs, wrappers, ACL or business state. */
export function createOcrTextArtifactCache(now: () => number = Date.now): OcrTextArtifactCache {
  const entries = new Map<string, CachedText>();
  let retainedBytes = 0;

  function remove(digest: string): void {
    const entry = entries.get(digest);
    if (!entry) return;
    retainedBytes -= entry.bytes;
    clearTimeout(entry.expiryTimer);
    entries.delete(digest);
  }

  function authorizedKey(key: OcrTextCacheKey, actorScope: string, signal: AbortSignal): boolean {
    return (
      !signal.aborted &&
      actorScope.length > 0 &&
      key.actorScope === actorScope &&
      /^[a-f0-9]{64}$/.test(key.digest)
    );
  }

  function expire(): void {
    const timestamp = now();
    for (const [digest, entry] of entries) if (entry.expiresAt <= timestamp) remove(digest);
  }

  return {
    get(key: OcrTextCacheKey, actorScope: string, signal: AbortSignal): string | undefined {
      if (!authorizedKey(key, actorScope, signal)) return undefined;
      expire();
      const cacheId = JSON.stringify([actorScope, key.digest]);
      const cached = entries.get(cacheId);
      if (!cached) return undefined;
      entries.delete(cacheId);
      entries.set(cacheId, cached);
      return cached.text;
    },
    set(
      key: OcrTextCacheKey,
      actorScope: string,
      artifact: OcrTextArtifact,
      signal: AbortSignal,
    ): boolean {
      if (!authorizedKey(key, actorScope, signal)) return false;
      expire();
      const cacheId = JSON.stringify([actorScope, key.digest]);
      remove(cacheId);
      if (
        artifact.status !== "complete" ||
        !artifact.text?.trim() ||
        UNCERTAIN_OR_INCOMPLETE.test(artifact.text)
      )
        return false;
      const bytes = Buffer.byteLength(artifact.text, "utf8");
      if (bytes > MAX_BYTES) return false;
      while (entries.size >= MAX_ENTRIES || retainedBytes + bytes > MAX_BYTES) {
        const oldest = entries.keys().next().value;
        if (!oldest) break;
        remove(oldest);
      }
      const expiryTimer = setTimeout((): void => remove(cacheId), TTL_MS);
      expiryTimer.unref();
      entries.set(cacheId, { text: artifact.text, bytes, expiresAt: now() + TTL_MS, expiryTimer });
      retainedBytes += bytes;
      return true;
    },
  };
}

export const immutableOcrTextCache: OcrTextArtifactCache = createOcrTextArtifactCache();
