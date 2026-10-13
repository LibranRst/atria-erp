import { z } from "zod";

export const PRIVATE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const PRIVATE_ATTACHMENT_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};
export const privateAttachmentPurposeSchema = z.enum(["expense", "bank_statement", "ai_chat"]);
export type PrivateAttachmentPurpose = z.infer<typeof privateAttachmentPurposeSchema>;
export const privateAttachmentUploadSchema = z
  .object({
    purpose: privateAttachmentPurposeSchema,
    projectId: z.guid().optional(),
  })
  .refine((value) => value.purpose !== "expense" || Boolean(value.projectId), {
    message: "Pilih proyek sebelum mengunggah bukti.",
    path: ["projectId"],
  });
export const privateAttachmentResultSchema = z.object({
  fileId: z.string().uuid(),
  url: z.string().url(),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive().max(PRIVATE_ATTACHMENT_MAX_BYTES),
});
export type PrivateAttachmentResult = z.infer<typeof privateAttachmentResultSchema>;
