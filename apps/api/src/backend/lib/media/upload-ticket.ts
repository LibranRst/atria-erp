import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  privateAttachmentUploadSchema,
  PRIVATE_ATTACHMENT_MAX_BYTES,
} from "@atria/core/media/private-attachment";

export const uploadTicketInputSchema = z
  .object({
    purpose: privateAttachmentUploadSchema.shape.purpose,
    projectId: z.guid().optional(),
    fileName: z.string().min(1).max(255),
    size: z.number().int().positive().max(PRIVATE_ATTACHMENT_MAX_BYTES),
  })
  .refine((value) => value.purpose !== "expense" || Boolean(value.projectId), {
    message: "Pilih proyek sebelum mengunggah bukti.",
  });
const ticketSchema = uploadTicketInputSchema.safeExtend({
  userId: z.guid(),
  sessionId: z.string().min(1).max(255),
  nonce: z.string().uuid(),
  expiresAt: z.number().int(),
});
export type UploadTicketInput = z.infer<typeof uploadTicketInputSchema>;
export type UploadTicket = z.infer<typeof ticketSchema>;

export function signUploadTicket(
  input: UploadTicketInput,
  identity: { userId: string; sessionId: string },
  secret: string,
  now: number = Date.now(),
): string {
  const payload = ticketSchema.parse({
    ...input,
    ...identity,
    nonce: randomUUID(),
    expiresAt: now + 120_000,
  });
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`atria-upload-v1:${encoded}`)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyUploadTicket(
  value: string,
  secret: string,
  now: number = Date.now(),
): UploadTicket {
  if (value.length > 4096) throw new Error("Tiket unggah tidak valid.");
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) throw new Error("Tiket unggah tidak valid.");
  const expected = createHmac("sha256", secret).update(`atria-upload-v1:${encoded}`).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    throw new Error("Tiket unggah tidak valid.");
  const payload = ticketSchema.parse(
    JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
  );
  if (now >= payload.expiresAt || payload.expiresAt > now + 120_000)
    throw new Error("Tiket unggah kedaluwarsa. Pilih berkas kembali.");
  return payload;
}
