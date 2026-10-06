import { z } from "zod";
import {
  privateAttachmentResultSchema,
  type PrivateAttachmentResult,
} from "@atria/core/media/private-attachment";

const attachmentPath = /^\/api\/media\/attachments\/([^/]+)$/;

/** Rebase only authorized-storage-shaped references; leave persisted API data unchanged. */
export function rebasePrivateAttachmentLinks(
  value: unknown,
  targetOrigin: string | undefined,
  sourceOrigins: readonly string[],
): unknown {
  if (!targetOrigin) return value;
  const target = new URL(targetOrigin);
  const allowed = new Set(sourceOrigins.map((origin: string): string => new URL(origin).origin));
  function visit(item: unknown): unknown {
    if (typeof item === "string") {
      if (!/^https?:\/\//.test(item)) return item;
      try {
        const url = new URL(item);
        const id = attachmentPath.exec(url.pathname)?.[1];
        if (
          ["http:", "https:"].includes(url.protocol) &&
          allowed.has(url.origin) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          id &&
          z.uuid().safeParse(id).success
        ) {
          return new URL(url.pathname, target.origin).href;
        }
      } catch {
        // Ordinary labels and malformed/foreign references retain their original value.
      }
      return item;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (
      typeof item === "object" &&
      item !== null &&
      [Object.prototype, null].includes(Object.getPrototypeOf(item))
    ) {
      return Object.fromEntries(
        Object.entries(item).map(([key, entry]): [string, unknown] => [key, visit(entry)]),
      );
    }
    return item;
  }
  return visit(value);
}

/** An authenticated upload response is rendered through this browser's cookie-bearing proxy. */
export function browserPrivateAttachmentResult(
  value: unknown,
  origin: string,
): PrivateAttachmentResult {
  const result = privateAttachmentResultSchema.parse(value);
  const url = new URL(result.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== `/api/media/attachments/${result.fileId}`
  ) {
    throw new Error("Referensi lampiran tidak sesuai hasil unggahan.");
  }
  return { ...result, url: new URL(url.pathname, origin).href };
}
