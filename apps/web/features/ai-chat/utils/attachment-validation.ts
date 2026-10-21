import {
  PRIVATE_ATTACHMENT_MAX_BYTES,
  PRIVATE_ATTACHMENT_MIME_BY_EXTENSION,
} from "@atria/core/media/private-attachment";

export const MAX_ATTACHMENT_SIZE_BYTES = PRIVATE_ATTACHMENT_MAX_BYTES;
export const MAX_CHAT_ATTACHMENTS = 4;
export const SUPPORTED_ATTACHMENT_EXTENSIONS = Object.keys(
  PRIVATE_ATTACHMENT_MIME_BY_EXTENSION,
).map((extension) => `.${extension}`);
export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  ...new Set(Object.values(PRIVATE_ATTACHMENT_MIME_BY_EXTENSION)),
];
export const ACCEPTED_ATTACHMENT_INPUT = [
  ...SUPPORTED_ATTACHMENT_EXTENSIONS,
  ...SUPPORTED_ATTACHMENT_MIME_TYPES,
].join(",");
export const CHAT_ATTACHMENT_OPTIONS = [
  {
    id: "spreadsheet",
    label: "Spreadsheet",
    description: "XLSX, XLS, CSV",
    icon: "description",
    accept: ".xlsx,.xls,.csv",
  },
  {
    id: "image",
    label: "Foto / gambar",
    description: "JPG, PNG, WebP, GIF, HEIC/HEIF",
    icon: "image",
    accept: ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif",
  },
  {
    id: "pdf",
    label: "Dokumen PDF",
    description: "PDF, maksimal 5 halaman",
    icon: "description",
    accept: ".pdf",
  },
  {
    id: "text",
    label: "Teks / data",
    description: "TXT, Markdown, JSON",
    icon: "code",
    accept: ".txt,.md,.json",
  },
] as const;
export type FileCandidate = {
  readonly name: string;
  readonly type?: string;
  readonly size: number;
};
export type ValidationResult =
  { readonly valid: true } | { readonly valid: false; readonly reason: string };
export function isSupportedAttachment(file: FileCandidate): ValidationResult {
  if (file.size <= 0) return { valid: false, reason: `Berkas ${file.name} kosong.` };
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES)
    return { valid: false, reason: `Ukuran ${file.name} melebihi 10 MB.` };
  const extension = file.name.toLowerCase().split(".").at(-1) ?? "";
  if (!Object.hasOwn(PRIVATE_ATTACHMENT_MIME_BY_EXTENSION, extension))
    return {
      valid: false,
      reason: `Format berkas ${file.name} tidak didukung. Pilih gambar, PDF, spreadsheet, atau teks/data.`,
    };
  return { valid: true };
}
export function validateAttachmentBatch(
  files: readonly FileCandidate[],
  attachedCount: number,
): ValidationResult {
  if (files.length + attachedCount > MAX_CHAT_ATTACHMENTS)
    return {
      valid: false,
      reason: `Maksimal ${MAX_CHAT_ATTACHMENTS} lampiran per pesan. Tersisa ${Math.max(0, MAX_CHAT_ATTACHMENTS - attachedCount)} slot.`,
    };
  for (const file of files) {
    const result = isSupportedAttachment(file);
    if (!result.valid) return result;
  }
  return { valid: true };
}
