import type { ChatAttachment } from "../components/chat-composer";

export type InitialReplyIntentInput = {
  readonly question: string;
  readonly attachments?: readonly Pick<ChatAttachment, "mimeType">[];
};

type RequestDomain =
  | "settings"
  | "cash"
  | "project"
  | "stock"
  | "expense"
  | "vendor-bill"
  | "reconciliation"
  | "rap"
  | "rab"
  | "profile"
  | "staff";

const NEUTRAL_INTENTION = "Aku akan meninjau permintaanmu dulu.";

const DOMAINS: readonly RequestDomain[] = [
  "settings",
  "cash",
  "project",
  "stock",
  "expense",
  "vendor-bill",
  "reconciliation",
  "rap",
  "rab",
  "profile",
  "staff",
];

const DOMAIN_PATTERNS: Readonly<Record<RequestDomain, RegExp>> = {
  settings:
    /\b(?:settings|pengaturan|default perusahaan|standar perusahaan|margin standar perusahaan|gross margin perusahaan|plafon perusahaan)\b/,
  cash: /\b(?:saldo|kas|rekening|top[ -]?up|transfer)\b/,
  project: /\b(?:proyek|project|budget proyek|anggaran proyek)\b/,
  stock: /\b(?:stok|stock|gudang|persediaan|material master)\b/,
  expense: /\b(?:pengeluaran|expense|biaya|klaim)\b/,
  "vendor-bill": /\b(?:tagihan vendor|vendor bill|penerimaan barang)\b/,
  reconciliation: /\b(?:rekonsiliasi|mutasi bank|pasangan mutasi)\b/,
  rap: /\brap\b/,
  rab: /\brab\b/,
  profile: /\b(?:profil|profile|akun saya|nama saya)\b/,
  staff: /\b(?:staf|staff|karyawan|role)\b/,
};

const READ_INTENTIONS: Readonly<Partial<Record<RequestDomain, string>>> = {
  settings: "Aku akan memeriksa pengaturan perusahaan dulu.",
  cash: "Aku akan memeriksa data saldo dan rekening dulu.",
  project: "Aku akan memeriksa data dan budget proyek dulu.",
  stock: "Aku akan memeriksa data stok gudang dulu.",
};

const PROPOSAL_INTENTIONS: Readonly<Record<RequestDomain, string>> = {
  settings: "Aku akan menyiapkan usulan perubahan pengaturan untuk kamu periksa.",
  cash: "Aku akan meninjau permintaan kas ini dan menyiapkan usulan untuk kamu periksa.",
  project: "Aku akan menyiapkan usulan proyek untuk kamu periksa.",
  stock: "Aku akan menyiapkan usulan perubahan stok untuk kamu periksa.",
  expense: "Aku akan menyiapkan usulan pengeluaran untuk kamu periksa.",
  "vendor-bill": "Aku akan menyiapkan usulan tagihan atau penerimaan untuk kamu periksa.",
  reconciliation: "Aku akan menyiapkan usulan pencocokan mutasi untuk kamu periksa.",
  rap: "Aku akan menyiapkan usulan RAP untuk kamu periksa.",
  rab: "Aku akan menyiapkan usulan RAB untuk kamu periksa.",
  profile: "Aku akan menyiapkan usulan perubahan profil untuk kamu periksa.",
  staff: "Aku akan menyiapkan usulan perubahan staf dan akses untuk kamu periksa.",
};

const ACTION_REQUEST =
  /\b(?:siapkan|buat(?:kan)?|ubah|koreksi|revisi|ajukan|verifikasi|setujui|bayar(?:kan)?|catat|cocokkan|transfer|tambahkan|tambah|terima|aktifkan|nonaktifkan|reserve|reservasi)\b/;
const READ_REQUEST = /\b(?:berapa|cek|periksa|lihat|tampilkan|cari|sebutkan|ringkas|jelaskan)\b|\?/;
const DOCUMENT_READ_REQUEST =
  /\b(?:baca|ekstrak|extract|transkripsi|transcribe|periksa|cek|analisis|sebutkan|ringkas|tampilkan)\b/;
const DOCUMENT_REFERENCE =
  /\b(?:lampiran|terlampir|dokumen|file|berkas|invoice|struk|nota|foto|gambar|pdf)\b/;

function supportedDocumentAttachment(attachment: Pick<ChatAttachment, "mimeType">): boolean {
  return /^(?:image\/(?:jpeg|png|webp|gif|heic|heif)|application\/pdf|text\/(?:plain|csv))$/i.test(
    attachment.mimeType,
  );
}

function ambiguousRequest(question: string): boolean {
  // These cues need interpretation from the actual model/tool flow. A local
  // sentence must not turn quoted instructions, negation, or an unsupported
  // operation into a promise to carry it out.
  return (
    /\b(?:abaikan|ignore|instruksi|instruction|system prompt|sql|payroll|hapus|delete)\b/.test(
      question,
    ) ||
    /\b(?:cara|bagaimana|how|jika|kalau|misalnya|contoh|arti|maksud|definisi|terjemahkan|translate)\b/.test(
      question,
    ) ||
    /\b(?:jelaskan tulisan|jelaskan kalimat|yang tadi|seperti tadi|yang itu)\b/.test(question) ||
    /\b(?:jangan|tidak perlu|gak usah|gk usah|ga usah|nggak usah|do not|don't)\s+(?:siapkan|buat(?:kan)?|ubah|koreksi|revisi|bayar(?:kan)?|catat|cocokkan|transfer|tambahkan|tambah|terima|aktifkan|nonaktifkan|reserve|reservasi|baca|cek|periksa)\b/.test(
      question,
    )
  );
}

function requestedDomains(question: string): readonly RequestDomain[] {
  const domains = DOMAINS.filter((domain) => DOMAIN_PATTERNS[domain].test(question));

  // A project reference supplies scope for a single workflow, rather than a
  // second promise. Likewise, bank mutations are the reconciliation domain.
  return domains.filter(
    (domain) =>
      !(
        domain === "project" &&
        domains.length > 1 &&
        !domains.includes("settings") &&
        !/\b(?:budget|anggaran|margin|plafon|nilai proyek|nilai kontrak|realisasi)\b/.test(question)
      ) && !(domain === "cash" && domains.includes("reconciliation")),
  );
}

/**
 * Local intention copy for the submitted turn. It describes a possible next
 * step, never a completed read, granted permission, or committed mutation.
 * The caller supplies the submitted snapshot, not the editable composer draft.
 */
export function getInitialReplyIntent({
  question,
  attachments = [],
}: InitialReplyIntentInput): string {
  const normalized = question
    .toLocaleLowerCase("id-ID")
    .replace(
      /\b(?:jangan|tanpa)\s+(?:simpan(?:\s+(?:perubahan|transaksi|data))?|buat\s+usulan|ubah\s+data)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (ambiguousRequest(normalized)) return NEUTRAL_INTENTION;

  const domains = requestedDomains(normalized);
  if (domains.length > 1) return NEUTRAL_INTENTION;

  const domain = domains[0];
  if (domain && ACTION_REQUEST.test(normalized)) return PROPOSAL_INTENTIONS[domain];

  if (
    attachments.length > 0 &&
    attachments.every(supportedDocumentAttachment) &&
    (normalized.length === 0 ||
      (DOCUMENT_READ_REQUEST.test(normalized) && DOCUMENT_REFERENCE.test(normalized)))
  ) {
    return attachments.length === 1 && /\binvoice\b/.test(normalized)
      ? "Aku akan membaca invoice ini dulu."
      : "Aku akan membaca lampiranmu dulu.";
  }

  if (domain && READ_REQUEST.test(normalized)) return READ_INTENTIONS[domain] ?? NEUTRAL_INTENTION;
  return NEUTRAL_INTENTION;
}
