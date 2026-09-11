import { signImagekit } from "@/app/actions/media/sign-imagekit";

/**
 * Satu-satunya jalur unggah berkas dari peramban ke ImageKit.
 *
 * Sebelumnya badan fungsi ini disalin utuh di dua tempat — nota lapangan dan
 * cover proyek — lengkap dengan public key yang ditanam sebagai fallback di
 * masing-masing berkas. Avatar adalah pemanggil ketiga; menyalinnya sekali lagi
 * berarti menyebar konstanta yang sama ke tiga tempat.
 *
 * Unggah berjalan langsung dari peramban, bukan lewat Server Action: badan
 * Server Action dibatasi 1 MB secara bawaan dan foto kamera ponsel menembusnya
 * hampir selalu. `IMAGEKIT_PRIVATE_KEY` tetap tidak pernah meninggalkan server —
 * yang dikirim ke klien hanya tanda tangan sekali pakai.
 */

const IMAGEKIT_UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";

/**
 * Public key ImageKit memang tidak rahasia — ia dikirim apa adanya dalam setiap
 * unggahan dari peramban. Nilainya tetap dipusatkan di sini supaya konfigurasi
 * lingkungan bisa menimpanya tanpa menyentuh kode, dan supaya tidak ada
 * pemanggil yang menanam salinannya sendiri lagi.
 */
const IMAGEKIT_PUBLIC_KEY_FALLBACK = "public_PRvr9hXwFetaQx4ZejdGwJ1Ue8=";

export type ImageKitFolder =
  | "/field-receipts"
  | "/project-covers"
  | "/user-avatars"
  | "/chat-attachments";

export type ImageKitUploadResult = {
  readonly fileId: string;
  readonly url: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
};

type ImageKitUploadResponse = {
  readonly fileId?: string;
  readonly name?: string;
  readonly url?: string;
  readonly size?: number;
  readonly fileType?: string;
  readonly message?: string;
};

export type UploadToImageKitOptions = {
  readonly file: File;
  readonly folder: ImageKitFolder;
  /** Awalan nama berkas di CDN, mis. `receipt` → `receipt-1724500000000-nota.jpg`. */
  readonly fileNamePrefix: string;
  /** Objek yang disebut di pesan galat, mis. "nota" → "Gagal mengunggah nota…". */
  readonly subject: string;
};

function getPublicKey(): string {
  // Referensi penuh, bukan destructuring: hanya bentuk ini yang di-inline Next
  // ke bundel klien.
  return process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || IMAGEKIT_PUBLIC_KEY_FALLBACK;
}

function resolveMimeType(fileName: string, providedMime?: string): string {
  if (providedMime && providedMime !== "application/octet-stream" && providedMime !== "non-image") {
    return providedMime;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";

  return providedMime || "application/octet-stream";
}

export async function uploadToImageKit({
  file,
  folder,
  fileNamePrefix,
  subject,
}: UploadToImageKitOptions): Promise<ImageKitUploadResult> {
  const signature = await signImagekit();
  if (!signature.success) {
    throw new Error(signature.error.message || `Gagal melakukan otentikasi unggah ${subject}.`);
  }

  const safeFileName = `${fileNamePrefix}-${Date.now()}-${file.name.replaceAll(" ", "_")}`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", safeFileName);
  formData.append("publicKey", getPublicKey());
  formData.append("signature", signature.data.signature);
  formData.append("token", signature.data.token);
  formData.append("expire", signature.data.expire.toString());
  formData.append("folder", folder);

  const uploadRes = await fetch(IMAGEKIT_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  });

  const uploadData = (await uploadRes.json().catch(() => ({}))) as ImageKitUploadResponse;

  if (!uploadRes.ok || !uploadData.url) {
    throw new Error(uploadData.message || `Gagal mengunggah ${subject} ke storage CDN.`);
  }

  const resolvedMime = resolveMimeType(
    file.name,
    file.type || (uploadData.fileType === "non-image" ? undefined : uploadData.fileType),
  );

  return {
    fileId: uploadData.fileId ?? "",
    url: uploadData.url,
    fileName: uploadData.name || safeFileName,
    mimeType: resolvedMime,
    size: uploadData.size || file.size,
  };
}
