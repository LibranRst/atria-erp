/** Generation effort is an optimization, never an authorization or source-read policy. */
export type ChatWorkloadProfile = "simple" | "bounded" | "complex";

export type ChatWorkloadInput = {
  readonly question: string;
  readonly hasAttachments?: boolean;
  readonly activeTools?: readonly string[];
};

const FACT_DOMAINS: readonly RegExp[] = [
  /\b(budget|anggaran|plafon|margin|alokasi|realisasi|nilai kontrak|nilai proyek)\b/i,
  /\b(saldo|rekening|kas|arus kas|cash flow|bank)\b/i,
  /\b(stok|stock|gudang|inventory|material|katalog)\b/i,
  /\b(pengeluaran|expense|biaya|persetujuan|approval)\b/i,
  /\b(tagihan|invoice|utang|hutang|vendor|supplier|pemasok|termin|piutang)\b/i,
  /\b(profil|profile|avatar|foto|nama saya|nama sendiri)\b/i,
  /\b(staf|staff|role|peran|izin|permission|akses|pengguna|karyawan)\b/i,
  /\b(daftar proyek|proyek aktif|proyek terdaftar|status proyek|pm|project manager|klien|pelanggan)\b/i,
];
const SETTINGS_DOMAIN =
  /\b(setting|settings|pengaturan|default|rasio|persentase|template|quick start|onboarding)\b/i;
const ACTION_INTENT =
  /\b(siapkan|buat|catat|ubah|koreksi|hapus|bayar|ajukan|setujui|tolak|terapkan|impor|import|aktifkan|nonaktifkan|transfer|finalisasi|kunci|revisi|edit|update|create|approve|reject|submit|record|pay|usulan|draft|draf|ekspor|export)\b/i;
const FACT_INTENT =
  /^\s*(?:(?:tolong|coba|please)\s+)?(?:berapa|siapa|cek|periksa|lihat|tampilkan|jelaskan|apa|bagaimana|ambil data|ringkas|daftar)\b/i;

/** A lexical guard only; the stream must also have its own fresh server snapshot. */
export function isLiteralOwnNameOnlyEdit(question: string): boolean {
  if (
    question.length > 400 ||
    /[?\n\r;]/u.test(question) ||
    /\b(?:dan|serta|lalu|kemudian|juga|tapi|tetapi|namun|atau|tadi|itu|tersebut|barusan|sebelumnya|lanjut|bagaimana|berapa|apakah|kenapa|jelaskan|foto|avatar|gambar|file|berkas|lampiran|attachment|staf|staff|karyawan|pengguna|role|peran|email|password|sandi|izin|akses|keamanan|saldo|rekening|kas|budget|anggaran|margin|rap|rab|stok|stock|gudang|pengeluaran|expense|tagihan|invoice|klien|vendor|bayar|transfer)\b/i.test(
      question,
    )
  )
    return false;
  const command = question
    .trim()
    .replace(/[.!]\s*jangan\s+(?:simpan|terapkan)(?:\s+perubahan(?:nya)?)?(?:\s+dulu)?[.!]?$/iu, "")
    .replace(/[.!]$/u, "")
    .trim();
  const matched = command.match(
    /^(?:tolong\s+)?(?:(?:siapkan|buat)\s+(?:usulan|draf|draft)(?:\s+(?:perubahan|koreksi|ubah|ganti))?\s+|(?:ubah|ganti|koreksi)\s+)nama\s+(?:(?:profil|akun)\s+)?(?:saya|aku)\s+(?:menjadi|jadi|ke)\s+(.+)$/iu,
  );
  let name = matched?.[1]?.trim();
  if (!name) return false;
  if (
    (name.startsWith('"') && name.endsWith('"')) ||
    (name.startsWith("“") && name.endsWith("”")) ||
    (name.startsWith("'") && name.endsWith("'"))
  )
    name = name.slice(1, -1).trim();
  return (
    name.length > 0 &&
    name.length <= 80 &&
    !/\b(?:jangan|ubah|ganti|siapkan|buat|catat|simpan|terapkan|hapus|baca|ikuti|abaikan|jalankan|pilih|tambah|koreksi|dari|untuk|dengan|agar|supaya|sesuai|seperti|yang)\b/i.test(
      name,
    ) &&
    /^[\p{L}\p{N}][\p{L}\p{N} '\u2019-]*$/u.test(name)
  );
}

/** Unknown or relational requests keep full effort; ordinary known work uses less. */
export function classifyChatWorkload(input: ChatWorkloadInput): ChatWorkloadProfile {
  const question = input.question.trim();
  const intent = question.replace(/\bjangan\b[^.!?\n]*/gi, "").trim();
  if (
    question.length > 1200 ||
    /\b(bandingkan|perbandingan|dibandingkan|compare|versus|analisis mendalam|seluruh riwayat|semua periode|semua proyek|seluruh proyek|ribuan|ratusan|semua halaman|seluruh halaman)\b/i.test(
      intent,
    ) ||
    /\b(tadi|itu|tersebut|barusan|sebelumnya|lanjut|yang sama)\b/i.test(intent)
  )
    return "complex";

  if (input.hasAttachments) return "bounded";
  if (/^(halo|hai|hi|hello|pagi|siang|sore|malam|terima kasih|makasih)[!.?\s]*$/i.test(intent))
    return "simple";

  const domains = FACT_DOMAINS.filter((domain) => domain.test(intent));
  const action = ACTION_INTENT.test(intent);
  if (!action && domains.length > 1) return "complex";
  if (
    action &&
    /\b(?:dan|lalu|kemudian|setelah itu)\s+(?:buat|catat|ubah|koreksi|hapus|bayar|ajukan|setujui|tolak|terapkan|transfer|finalisasi|kunci|revisi|impor)\b/i.test(
      intent,
    )
  )
    return "complex";
  if (action) return "bounded";
  if (
    (domains.length === 1 || (domains.length === 0 && SETTINGS_DOMAIN.test(intent))) &&
    FACT_INTENT.test(intent) &&
    question.length <= 400
  ) {
    // A full catalog generally means the current intent was not resolved. Do not
    // turn an ambiguous routed request into the low-effort path.
    if (input.activeTools && input.activeTools.length > 40) return "complex";
    return "simple";
  }
  return "complex";
}

export type NineRouterChatModelSelection = {
  readonly modelId: string;
  readonly reasoningEffort: string;
  readonly adaptive: boolean;
};

function isClearSingleExpenseDraft(question: string): boolean {
  if (
    question.length > 500 ||
    /[\n\r;?]/.test(question) ||
    /\b(?:dan|serta|lalu|kemudian|juga|atau|batch|massal|beberapa|semua|seluruh|pilih|pilihan|mana|yang|tadi|itu|tersebut|barusan|sebelumnya|sama|riwayat|historis|kemarin|bulan|minggu|tahun|stok|rap|rab|material|vendor|tagihan|invoice|bank|saldo|transfer|bayar)\b/i.test(
      question,
    )
  )
    return false;
  const command = question
    .trim()
    .replace(/[.!]\s*jangan\s+(?:simpan|terapkan)(?:\s+perubahan(?:nya)?)?(?:\s+dulu)?[.!]?$/iu, "")
    .replace(/[.!]$/u, "")
    .trim();
  const matched = command.match(
    /^(?:tolong\s+)?(?:siapkan|buat)\s+(?:usulan|draf|draft)\s+pengeluaran\s+(?:Operasional|Lain-lain)\s+(?:Rp|IDR)\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?(?:\s+(?:ribu|juta|rb|jt))?\s+untuk\s+(.+?)\s+di\s+(?:proyek|project)\s+([\p{L}\p{N}][\p{L}\p{N} &'’()/-]+)$/iu,
  );
  if (!matched) return false;
  const description = matched[1].trim();
  const project = matched[2].trim();
  return (
    description.length >= 4 &&
    description.length <= 120 &&
    project.length >= 4 &&
    project.length <= 100
  );
}

/** A clear, single simple expense can start lightly without changing the existing tool choices. */
export function selectChatStepProfile(input: {
  readonly profile: ChatWorkloadProfile;
  readonly stepNumber: number;
  readonly question: string;
  readonly activeTools: readonly string[];
  readonly hasAttachments?: boolean;
  readonly historical?: boolean;
}): ChatWorkloadProfile {
  if (
    input.profile === "bounded" &&
    input.stepNumber === 0 &&
    !input.hasAttachments &&
    !input.historical &&
    input.activeTools.includes("listProjects") &&
    input.activeTools.includes("proposeExpenseDraft") &&
    isClearSingleExpenseDraft(input.question)
  )
    return "simple";
  return input.profile;
}

const VERIFIED_FLASH_MODELS = new Set([
  "ag/gemini-3.8-flash-low",
  "ag/gemini-3.8-flash-medium",
  "ag/gemini-3.8-flash-high",
]);
const PROFILE_EFFORT: Readonly<Record<ChatWorkloadProfile, "low" | "medium" | "high">> = {
  simple: "low",
  bounded: "medium",
  complex: "high",
};

/** Only the verified configured family is adaptive; custom models stay exact. */
export function selectNineRouterChatModel(input: {
  readonly normalizedModelId: string;
  readonly configuredReasoningEffort: string;
  readonly profile?: ChatWorkloadProfile;
}): NineRouterChatModelSelection {
  if (!input.profile || !VERIFIED_FLASH_MODELS.has(input.normalizedModelId))
    return {
      modelId: input.normalizedModelId,
      reasoningEffort: input.configuredReasoningEffort,
      adaptive: false,
    };
  const effort = PROFILE_EFFORT[input.profile];
  return {
    modelId: `ag/gemini-3.8-flash-${effort}`,
    reasoningEffort: effort,
    adaptive: true,
  };
}
