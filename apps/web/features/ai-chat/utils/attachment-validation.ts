export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".pdf",
  ".csv",
  ".xlsx",
  ".xls",
  ".txt",
  ".md",
] as const;

export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const ACCEPTED_ATTACHMENT_INPUT = [
  "image/*",
  ".pdf",
  "application/pdf",
  ".csv",
  "text/csv",
  ".xlsx",
  ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  ".txt",
  ".md",
].join(",");

export type FileCandidate = {
  readonly name: string;
  readonly type?: string;
  readonly size: number;
};

export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

export function isSupportedAttachment(file: FileCandidate): ValidationResult {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      reason: `Ukuran ${file.name} melebihi 10 MB.`,
    };
  }

  const name = file.name.toLowerCase();
  const mime = (file.type ?? "").toLowerCase();

  const isSupportedExtension = SUPPORTED_ATTACHMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
  const isImageMime = mime.startsWith("image/");
  const isSupportedMime = (SUPPORTED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mime);

  if (!isSupportedExtension && !isImageMime && !isSupportedMime) {
    return {
      valid: false,
      reason: `Format berkas ${file.name} tidak didukung. Format yang didukung: Gambar, PDF, Excel, CSV, dan TXT.`,
    };
  }

  return { valid: true };
}
