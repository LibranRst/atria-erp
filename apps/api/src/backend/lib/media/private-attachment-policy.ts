import {
  PRIVATE_ATTACHMENT_MAX_BYTES,
  PRIVATE_ATTACHMENT_MIME_BY_EXTENSION,
} from "@atria/core/media/private-attachment";
import { z } from "zod";

const idSchema = z.string().uuid();

export function privateAttachmentId(url: string, origins: readonly string[]): string {
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !origins.some((origin) => new URL(origin).origin === parsed.origin)
  ) {
    throw new Error("Referensi lampiran tidak diizinkan.");
  }
  const match = /^\/api\/media\/attachments\/([^/]+)$/.exec(parsed.pathname);
  if (!match) throw new Error("Gunakan lampiran yang diunggah melalui Atria.");
  return idSchema.parse(match[1]);
}

export function imagekitSource(url: string, endpoint: string): string {
  const source = new URL(url);
  const base = new URL(endpoint.endsWith("/") ? endpoint : `${endpoint}/`);
  if (
    base.protocol !== "https:" ||
    base.hostname !== "ik.imagekit.io" ||
    source.origin !== base.origin ||
    source.username ||
    source.password ||
    source.search ||
    source.hash ||
    !source.pathname.startsWith(base.pathname) ||
    source.pathname === base.pathname
  ) {
    throw new Error("Storage lampiran tidak diizinkan.");
  }
  return source.pathname.slice(base.pathname.length - 1);
}

export function attachmentMime(fileName: string, size: number): string {
  const extension = fileName.toLowerCase().split(".").at(-1) ?? "";
  const mime = Object.hasOwn(PRIVATE_ATTACHMENT_MIME_BY_EXTENSION, extension)
    ? PRIVATE_ATTACHMENT_MIME_BY_EXTENSION[extension]
    : undefined;
  if (!mime || size <= 0 || size > PRIVATE_ATTACHMENT_MAX_BYTES) {
    throw new Error("Format berkas tidak didukung atau ukuran melebihi 10 MB.");
  }
  return mime;
}

export function assertAttachmentBytes(bytes: Uint8Array, mime: string): void {
  const starts = (values: readonly number[]): boolean => values.every((v, i) => bytes[i] === v);
  const ascii = (start: number, end: number): string =>
    new TextDecoder().decode(bytes.slice(start, end));
  const valid =
    mime === "image/jpeg"
      ? starts([0xff, 0xd8, 0xff])
      : mime === "image/png"
        ? starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        : mime === "image/webp"
          ? ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP"
          : mime === "image/gif"
            ? ["GIF87a", "GIF89a"].includes(ascii(0, 6))
            : mime === "image/heic" || mime === "image/heif"
              ? ascii(4, 8) === "ftyp"
              : mime === "application/pdf"
                ? ascii(0, 5) === "%PDF-"
                : mime.includes("spreadsheetml")
                  ? starts([0x50, 0x4b, 0x03, 0x04])
                  : mime === "application/vnd.ms-excel"
                    ? starts([0xd0, 0xcf, 0x11, 0xe0])
                    : !bytes.includes(0);
  if (!valid) throw new Error("Isi berkas tidak sesuai format yang dipilih.");
}

export async function boundedAttachmentBody(response: Response): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error("Lampiran belum dapat diunduh.");
  const declared = Number(response.headers.get("content-length"));
  if (declared > PRIVATE_ATTACHMENT_MAX_BYTES) throw new Error("Lampiran melebihi 10 MB.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > PRIVATE_ATTACHMENT_MAX_BYTES) throw new Error("Lampiran melebihi 10 MB.");
      chunks.push(result.value);
    }
  } finally {
    await reader.cancel();
  }
  if (size === 0) throw new Error("Lampiran kosong.");
  return Buffer.concat(chunks, size);
}
