import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  assertAttachmentBytes,
  imagekitSource,
} from "@backend/lib/media/private-attachment-policy";
import { OwnProfileError } from "./update-own-profile";
export type StoredProfileAvatar = { readonly fileId: string; readonly url: string };
/** Same square centre-crop as the manual avatar. Decode bounded pixels, rotate, strip metadata. */
export async function profileAvatarJpeg(bytes: Uint8Array, mime: string): Promise<Buffer> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime) || bytes.length > 8 * 1024 * 1024)
    throw new OwnProfileError("VALIDATION_ERROR", "Gunakan JPG, PNG atau WebP maksimal8 MB.");
  try {
    assertAttachmentBytes(bytes, mime);
    return await sharp(bytes, { limitInputPixels: 16_000_000, failOn: "error" })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new OwnProfileError("VALIDATION_ERROR", "Foto tidak dapat dibaca. Pilih gambar lain.");
  }
}
export async function storeProfileAvatar(bytes: Uint8Array): Promise<StoredProfileAvatar> {
  const endpoint =
      process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? process.env.IMAGEKIT_URL_ENDPOINT,
    key = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!endpoint || !key)
    throw new OwnProfileError(
      "TRANSACTION_FAILED",
      "Unggah foto belum tersedia. Coba lagi atau simpan perubahan nama terlebih dahulu.",
    );
  imagekitSource(`${endpoint.replace(/\/$/, "")}/configuration-check`, endpoint);
  const form = new FormData();
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    `avatar-${randomUUID()}.jpg`,
  );
  form.set("fileName", `avatar-${randomUUID()}.jpg`);
  form.set("folder", "/user-avatars");
  form.set("isPrivateFile", "false");
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form,
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new OwnProfileError("TRANSACTION_FAILED", "Foto belum berhasil disimpan. Coba lagi.");
  const saved = z
    .object({ fileId: z.string().min(1).max(255), url: z.string().url() })
    .parse(await response.json());
  imagekitSource(saved.url, endpoint);
  return saved;
}
export async function discardProfileAvatar(fileId: string): Promise<void> {
  const key = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!key) return;
  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error("Uncommitted avatar cleanup failed");
}
