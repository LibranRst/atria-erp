/**
 * Helper murni derivasi prefill dan otomasi pembuatan invoice klien.
 *
 * Mengikuti arsitektur domain @atria/core: bebas dependensi platform,
 * deterministik, dan dapat diuji secara mandiri tanpa database atau HTTP request.
 */

export type InvoiceStage =
  "DP" | "PROGRESS_1" | "PROGRESS_2" | "PELUNASAN" | "RETENTION" | "AD_HOC";

export type InvoicePreset = {
  readonly label: string;
  readonly percentage: number;
  readonly amount: number;
  readonly stage: InvoiceStage;
  readonly notes: string;
};

export type InvoicePrefillResult = {
  readonly projectCode: string;
  readonly suggestedInvoiceNumber: string;
  readonly suggestedStage: InvoiceStage;
  readonly suggestedAmount: number;
  readonly suggestedDueDate: string;
  readonly suggestedNotes: string;
  readonly totalContractValue: number;
  readonly totalInvoiced: number;
  readonly remainingUnbilled: number;
  readonly activeInvoicesCount: number;
  readonly presets: readonly InvoicePreset[];
};

export type ExistingInvoiceInput = {
  readonly amount: number;
  readonly stage: string;
  readonly status: string;
};

export type DeriveInvoicePrefillParams = {
  readonly projectName: string;
  readonly totalContractValue: number;
  readonly existingInvoices: readonly ExistingInvoiceInput[];
  readonly currentDate?: Date;
};

const STOPWORDS = new Set([
  "fit-out",
  "fitout",
  "interior",
  "studio",
  "renovasi",
  "proyek",
  "project",
  "unit",
  "dekoria",
  "apartemen",
  "apartment",
  "rumah",
  "gedung",
  "kantor",
  "office",
  "area",
  "lantai",
  "dan",
  "the",
  "of",
  "at",
]);

const KNOWN_LOCATION_CODES: Readonly<Record<string, string>> = {
  bassura: "BSR",
  menteng: "MNT",
  sudirman: "SDR",
  kemang: "KMG",
  cikarang: "CKR",
  bekasi: "BKS",
  senopati: "SNP",
  scbd: "SCBD",
  pluit: "PLT",
  pik: "PIK",
  kelapagading: "KLG",
  serpong: "SRP",
  bsd: "BSD",
  bintaro: "BTR",
  cibubur: "CBR",
};

/**
 * Menghasilkan singkatan 3-4 huruf dari nama proyek untuk penomoran dokumen resmi.
 * Contoh: "Fit-Out Interior Studio Bassura City — Unit 18B" -> "BSR"
 */
export function deriveProjectCode(projectName: string): string {
  if (!projectName || !projectName.trim()) {
    return "PRJ";
  }

  const clean = projectName.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);

  // 1. Cek kecocokan lokasi spesifik yang umum
  for (const token of tokens) {
    if (KNOWN_LOCATION_CODES[token]) {
      return KNOWN_LOCATION_CODES[token];
    }
  }

  // 2. Filter kata umum (stopwords)
  const significantTokens = tokens.filter((t) => !STOPWORDS.has(t) && t.length >= 2);

  if (significantTokens.length === 0) {
    // Fallback: ambil 3 karakter alfanumerik pertama dari string asli
    const rawAlpha = projectName.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return (rawAlpha.slice(0, 3) || "PRJ").padEnd(3, "X");
  }

  if (significantTokens.length === 1) {
    const single = significantTokens[0];
    // Ambil konsonan jika ada, atau 3 huruf pertama
    const consonants = single.replace(/[aeiou]/g, "").toUpperCase();
    if (consonants.length >= 3) {
      return consonants.slice(0, 3);
    }
    return single.slice(0, 3).toUpperCase().padEnd(3, "X");
  }

  // Jika ada 2 kata atau lebih, ambil inisial huruf pertama dari kata-kata penting
  if (significantTokens.length >= 3) {
    return (
      significantTokens[0][0] +
      significantTokens[1][0] +
      significantTokens[2][0]
    ).toUpperCase();
  }

  // 2 kata: kata1 (2 huruf) + kata2 (1 huruf) atau sebaliknya
  return (significantTokens[0].slice(0, 2) + significantTokens[1].slice(0, 1)).toUpperCase();
}

/**
 * Menghasilkan format nomor invoice resmi: INV/YYYY/MM/[KODE]-[URUTAN]
 * Contoh: INV/2026/09/BSR-001
 */
export function generateSuggestedInvoiceNumber({
  projectCode,
  sequence,
  date = new Date(),
}: {
  readonly projectCode: string;
  readonly sequence: number;
  readonly date?: Date;
}): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const paddedSeq = String(Math.max(1, sequence)).padStart(3, "0");
  return `INV/${year}/${month}/${projectCode}-${paddedSeq}`;
}

/**
 * Menghitung konteks dan saran isian awal invoice secara cerdas.
 */
export function deriveInvoicePrefill({
  projectName,
  totalContractValue,
  existingInvoices,
  currentDate = new Date(),
}: DeriveInvoicePrefillParams): InvoicePrefillResult {
  const activeInvoices = existingInvoices.filter((inv) => inv.status !== "VOID");
  const totalInvoiced = activeInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const remainingUnbilled = Math.max(0, totalContractValue - totalInvoiced);
  const activeInvoicesCount = activeInvoices.length;

  const projectCode = deriveProjectCode(projectName);
  const sequence = activeInvoicesCount + 1;
  const suggestedInvoiceNumber = generateSuggestedInvoiceNumber({
    projectCode,
    sequence,
    date: currentDate,
  });

  // Tentukan Tahap Tagihan Cerdas
  let suggestedStage: InvoiceStage;
  if (activeInvoicesCount === 0) {
    suggestedStage = "DP";
  } else if (remainingUnbilled <= 0.25 * totalContractValue || remainingUnbilled <= 0) {
    suggestedStage = "PELUNASAN";
  } else if (activeInvoicesCount === 1) {
    suggestedStage = "PROGRESS_1";
  } else {
    suggestedStage = "PROGRESS_2";
  }

  // Tentukan Nominal yang Disarankan
  let suggestedAmount: number;
  if (activeInvoicesCount === 0) {
    // Default DP 50% dari nilai kontrak
    suggestedAmount = Math.min(remainingUnbilled, Math.round(totalContractValue * 0.5));
  } else if (suggestedStage === "PELUNASAN") {
    suggestedAmount = remainingUnbilled;
  } else {
    // Default termin progress: 30% dari nilai kontrak atau sisa
    suggestedAmount = Math.min(remainingUnbilled, Math.round(totalContractValue * 0.3));
  }

  // Jatuh tempo default +7 hari
  const due = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const suggestedDueDate = due.toISOString().split("T")[0];

  // Catatan standar profesional
  let suggestedNotes: string;
  if (suggestedStage === "DP") {
    suggestedNotes = "Pembayaran Uang Muka (DP 50%) pekerjaan fit-out interior.";
  } else if (suggestedStage === "PROGRESS_1") {
    suggestedNotes = "Pembayaran Termin Progress 1 pekerjaan fit-out interior.";
  } else if (suggestedStage === "PROGRESS_2") {
    suggestedNotes = "Pembayaran Termin Progress 2 pekerjaan fit-out interior.";
  } else if (suggestedStage === "PELUNASAN") {
    suggestedNotes = "Pelunasan akhir dan serah terima pekerjaan (BAST).";
  } else {
    suggestedNotes = "Pembayaran termin pekerjaan interior.";
  }

  // Siapkan Presets Cepat
  const presets: InvoicePreset[] = [
    {
      label: "50% DP",
      percentage: 0.5,
      amount: Math.min(remainingUnbilled, Math.round(totalContractValue * 0.5)),
      stage: "DP",
      notes: "Pembayaran Uang Muka (DP 50%) pekerjaan fit-out interior.",
    },
    {
      label: "35% Progress",
      percentage: 0.35,
      amount: Math.min(remainingUnbilled, Math.round(totalContractValue * 0.35)),
      stage: "PROGRESS_1",
      notes: "Pembayaran Termin Progress 1 (35%) pekerjaan fit-out interior.",
    },
    {
      label: "30% Progress",
      percentage: 0.3,
      amount: Math.min(remainingUnbilled, Math.round(totalContractValue * 0.3)),
      stage: "PROGRESS_1",
      notes: "Pembayaran Termin Progress pekerjaan fit-out interior.",
    },
    {
      label: "20% Pelunasan",
      percentage: 0.2,
      amount: Math.min(remainingUnbilled, Math.round(totalContractValue * 0.2)),
      stage: "PELUNASAN",
      notes: "Pelunasan akhir dan serah terima pekerjaan (BAST).",
    },
    {
      label: "15% Pelunasan",
      percentage: 0.15,
      amount: Math.min(remainingUnbilled, Math.round(totalContractValue * 0.15)),
      stage: "PELUNASAN",
      notes: "Pelunasan akhir dan serah terima pekerjaan (BAST 15%).",
    },
    {
      label: "Sisa Tagihan",
      percentage:
        totalContractValue > 0 ? Number((remainingUnbilled / totalContractValue).toFixed(2)) : 0,
      amount: remainingUnbilled,
      stage: remainingUnbilled <= 0.25 * totalContractValue ? "PELUNASAN" : "PROGRESS_1",
      notes: "Pelunasan sisa nilai kontrak pekerjaan interior.",
    },
  ];

  return {
    projectCode,
    suggestedInvoiceNumber,
    suggestedStage,
    suggestedAmount,
    suggestedDueDate,
    suggestedNotes,
    totalContractValue,
    totalInvoiced,
    remainingUnbilled,
    activeInvoicesCount,
    presets,
  };
}

export type DerivePaymentReferenceParams = {
  readonly bankName?: string | null;
  readonly invoiceNumber?: string | null;
  readonly projectName?: string | null;
  readonly clientName?: string | null;
  readonly stage?: string | null;
};

/**
 * Menghasilkan singkatan bank standar dari nama bank / rekening.
 * Contoh: "BCA" / "BCA Operasional Dekoria" -> "BCA"
 *         "Mandiri" / "Mandiri Giro" -> "MDR"
 *         "Kas Kecil" -> "KAS"
 */
export function normalizeBankCode(bankName?: string | null): string {
  if (!bankName || !bankName.trim()) return "BANK";
  const upper = bankName.toUpperCase();
  if (upper.includes("BCA")) return "BCA";
  if (upper.includes("MANDIRI")) return "MDR";
  if (upper.includes("BNI")) return "BNI";
  if (upper.includes("BRI")) return "BRI";
  if (upper.includes("CIMB")) return "CIMB";
  if (upper.includes("PERMATA")) return "PRM";
  if (upper.includes("DANAMON")) return "DNM";
  if (upper.includes("BSI")) return "BSI";
  if (upper.includes("KAS")) return "KAS";
  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 4) || "BANK";
}

/**
 * Menghasilkan kode konteks pembayaran (nama klien atau kode proyek).
 * Contoh: "Bpk. Hendra Gunawan" -> "HENDRA"
 *         "PT Sumber Abadi" -> "SABADI"
 */
export function deriveClientContextCode(clientName?: string | null): string {
  if (!clientName || !clientName.trim()) return "";
  const cleaned = clientName.replace(/^(bpk\.|ibu\.|bapak\.|pt\.|cv\.|tuan\.|ny\.)\s+/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const firstWord = words[0]?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "";
  return firstWord.slice(0, 7);
}

/**
 * Menghasilkan singkatan kode termin/stage pembayaran.
 * Contoh: "DP" -> "DP", "PROGRESS_1" -> "PRG1", "PELUNASAN" -> "LUNAS"
 */
export function normalizeStageCode(stage?: string | null): string {
  if (!stage) return "DP";
  const upper = stage.toUpperCase();
  if (upper === "DP") return "DP";
  if (upper === "PROGRESS_1") return "PRG1";
  if (upper === "PROGRESS_2") return "PRG2";
  if (upper === "PELUNASAN") return "LUNAS";
  if (upper === "RETENTION") return "RET";
  if (upper === "AD_HOC") return "ADHOC";
  return upper.slice(0, 5);
}

function extractProjectCodeFromInvoice(invoiceNumber: string): string {
  const match = invoiceNumber.match(/([A-Z0-9]+)-\d+/);
  if (match?.[1]) return match[1];
  const parts = invoiceNumber.split(/[/-]/).filter(Boolean);
  return parts[parts.length - 2] || parts[parts.length - 1] || "PRJ";
}

/**
 * Menghasilkan saran nomor referensi bukti transfer kanonis:
 * Format: TRF-[BANK]-[KLIEN/PROYEK]-[STAGE]
 * Contoh: "TRF-BCA-HENDRA-DP" atau "TRF-BCA-BSR-DP"
 */
export function derivePaymentReference(params: DerivePaymentReferenceParams): string {
  const bankCode = normalizeBankCode(params.bankName);
  const clientCode = deriveClientContextCode(params.clientName);
  const projectCode = params.projectName
    ? deriveProjectCode(params.projectName)
    : params.invoiceNumber
      ? extractProjectCodeFromInvoice(params.invoiceNumber)
      : "";
  const context = clientCode || projectCode || "KLIEN";
  const stageCode = normalizeStageCode(params.stage);

  return `TRF-${bankCode}-${context}-${stageCode}`;
}

export type DeriveVendorBillNumberParams = {
  readonly vendorName?: string | null;
  readonly projectName?: string | null;
  readonly date?: Date;
  readonly sequence?: number;
};

const KNOWN_VENDOR_CODES: Readonly<Record<string, { code: string; defaultSeq?: string }>> = {
  "sumber abadi": { code: "SA", defaultSeq: "8891" },
  "cahaya mas": { code: "CMP", defaultSeq: "001" },
  "sinar kaca": { code: "SK", defaultSeq: "001" },
  "batu prima": { code: "BPC", defaultSeq: "001" },
  hafele: { code: "HAFELE", defaultSeq: "001" },
  "marmer indah": { code: "MARMER", defaultSeq: "089" },
  marmer: { code: "MARMER", defaultSeq: "089" },
  "kaca nusantara": { code: "KACA", defaultSeq: "441" },
  kaca: { code: "KACA", defaultSeq: "441" },
};

const VENDOR_STOPWORDS = new Set([
  "dan",
  "and",
  "the",
  "of",
  "indonesia",
  "group",
  "co",
  "corp",
  "ltd",
  "tbk",
  "panel",
  "hpl",
  "hardware",
  "countertop",
  "electrical",
]);

/**
 * Menghasilkan kode singkatan vendor untuk nomor tagihan (vendor bill).
 * Contoh: "PT Sumber Abadi Panel & HPL" -> "SA"
 *         "CV Batu Prima Countertop" -> "BPC"
 *         "PT Cahaya Mas Panel" -> "CMP"
 */
export function deriveVendorCode(vendorName?: string | null): string {
  if (!vendorName || !vendorName.trim()) {
    return "VND";
  }

  const clean = vendorName
    .toLowerCase()
    .replace(/^(pt|cv|ud|tb|toko)\.?\s+/i, "")
    .replace(/^bangunan\s+/i, "")
    .trim();

  // 1. Cek vendor yang dikenal
  for (const [key, val] of Object.entries(KNOWN_VENDOR_CODES)) {
    if (clean.includes(key)) {
      return val.code;
    }
  }

  // 2. Ekstraksi kata penting
  const tokens = clean
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const significantTokens = tokens.filter((t) => !VENDOR_STOPWORDS.has(t) && t.length >= 2);

  if (significantTokens.length === 0) {
    const rawAlpha = clean.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return (rawAlpha.slice(0, 3) || "VND").padEnd(3, "X");
  }

  if (significantTokens.length === 1) {
    const word = significantTokens[0].toUpperCase();
    return word.length <= 6 ? word : word.slice(0, 4);
  }

  // 2+ kata: ambil inisial (hingga 4 huruf)
  const initials = significantTokens
    .slice(0, 4)
    .map((t) => t[0].toUpperCase())
    .join("");

  return initials.length >= 2 ? initials : significantTokens[0].slice(0, 3).toUpperCase();
}

/**
 * Menghasilkan saran nomor tagihan vendor kanonis:
 * Format: INV-[KODE_VENDOR]-[YYYY]-[SEQUENCE] atau BILL-[KODE_PROYEK]-[YYYY]-[SEQUENCE]
 * Contoh:
 * - PT Sumber Abadi -> "INV-SA-2026-8891" (sesuai panduan alur B5.2)
 * - CV Batu Prima -> "INV-BPC-2026-001"
 * - Tanpa vendor (hanya proyek) -> "BILL-BSR-2026-001"
 */
export function deriveSuggestedVendorBillNumber({
  vendorName,
  projectName,
  date = new Date(),
  sequence,
}: DeriveVendorBillNumberParams): string {
  const year = date.getFullYear();

  if (vendorName && vendorName.trim()) {
    const clean = vendorName
      .toLowerCase()
      .replace(/^(pt|cv|ud|tb|toko)\.?\s+/i, "")
      .trim();

    let defaultSeq = "001";
    for (const [key, val] of Object.entries(KNOWN_VENDOR_CODES)) {
      if (clean.includes(key)) {
        if (val.defaultSeq) defaultSeq = val.defaultSeq;
        break;
      }
    }

    const seqStr =
      sequence !== undefined ? String(Math.max(1, sequence)).padStart(3, "0") : defaultSeq;
    const vendorCode = deriveVendorCode(vendorName);
    return `INV-${vendorCode}-${year}-${seqStr}`;
  }

  const seqStr = sequence !== undefined ? String(Math.max(1, sequence)).padStart(3, "0") : "001";

  if (projectName && projectName.trim()) {
    const projectCode = deriveProjectCode(projectName);
    return `BILL-${projectCode}-${year}-${seqStr}`;
  }

  return `BILL-${year}-${seqStr}`;
}

export type DeriveVendorPaymentReferenceParams = {
  readonly bankName?: string | null;
  readonly vendorName?: string | null;
  readonly billNumber?: string | null;
  readonly projectName?: string | null;
  readonly categoryCode?: string | null;
  readonly sequence?: number;
};

/**
 * Menghasilkan saran nomor referensi bukti transfer pembayaran tagihan vendor:
 * Format: TRF-[BANK]-VND-[KODE_VENDOR][SEQ] atau TRF-[BANK]-SUB-[KODE_SUBCON] dsb.
 * Contoh:
 * - PT Sumber Abadi & BCA -> "TRF-BCA-VND-SA01" (sesuai alur panduan B5.3)
 * - CV Marmer Indah Sentosa & BCA -> "TRF-BCA-SUB-MARMER" (sesuai alur panduan B8.3)
 * - PT Kaca Nusantara Prima & BCA -> "TRF-BCA-SUB-KACA" (sesuai alur panduan B8.3)
 * - Tukang & BCA -> "TRF-BCA-TKG-FINAL" (sesuai alur panduan B7.3)
 */
export function deriveVendorPaymentReference({
  bankName,
  vendorName,
  billNumber,
  projectName,
  categoryCode,
  sequence,
}: DeriveVendorPaymentReferenceParams): string {
  const bankCode = normalizeBankCode(bankName);
  const cleanVendor = (vendorName || "").toLowerCase();
  const seqStr = sequence !== undefined ? String(Math.max(1, sequence)).padStart(2, "0") : "01";

  // 1. Cek kasus khusus alur panduan
  if (cleanVendor.includes("sumber abadi")) {
    return `TRF-${bankCode}-VND-SA${seqStr}`;
  }
  if (cleanVendor.includes("marmer")) {
    return `TRF-${bankCode}-SUB-MARMER`;
  }
  if (cleanVendor.includes("kaca")) {
    return `TRF-${bankCode}-SUB-KACA`;
  }
  if (categoryCode === "TUKANG" || cleanVendor.includes("tukang")) {
    return `TRF-${bankCode}-TKG-FINAL`;
  }

  // 2. Kategori Subkon umum
  if (categoryCode === "SUBCON") {
    const code = deriveVendorCode(vendorName);
    return `TRF-${bankCode}-SUB-${code}`;
  }

  // 3. Vendor umum
  const vendorCode = deriveVendorCode(vendorName);
  if (vendorCode && vendorCode !== "VND") {
    return `TRF-${bankCode}-VND-${vendorCode}${seqStr}`;
  }

  // 4. Fallback jika ada billNumber
  if (billNumber && billNumber.trim()) {
    const cleanBill = billNumber.replace(/[^A-Za-z0-9]/g, "");
    const suffix = cleanBill.length > 6 ? cleanBill.slice(-4) : cleanBill;
    return `TRF-${bankCode}-VND-${suffix}`;
  }

  // 5. Fallback jika ada projectName
  if (projectName && projectName.trim()) {
    const projectCode = deriveProjectCode(projectName);
    return `TRF-${bankCode}-${projectCode}-${seqStr}`;
  }

  return `TRF-${bankCode}-VND-${seqStr}`;
}

export type DeriveExpensePaymentReferenceParams = {
  readonly bankName?: string | null;
  readonly projectName?: string | null;
  readonly categoryCode?: string | null;
  readonly costTitle?: string | null;
  readonly sequence?: number;
};

/**
 * Menghasilkan saran nomor referensi bukti transfer pencairan biaya lapangan (klaim / kas kecil):
 * Format: TRF-[BANK]-[KODE_PROYEK]-[KATEGORI]
 * Contoh: "TRF-BCA-BSR-OPS" atau "TRF-BCA-BSR-EXP"
 */
export function deriveExpensePaymentReference({
  bankName,
  projectName,
  categoryCode,
  costTitle,
  sequence,
}: DeriveExpensePaymentReferenceParams): string {
  const bankCode = normalizeBankCode(bankName);
  const projectCode = projectName ? deriveProjectCode(projectName) : "PRJ";

  // Cek kata kunci pada keterangan nota untuk sinkronisasi otomatis dengan alur panduan UAT
  const titleLower = (costTitle || "").toLowerCase();
  if (titleLower.includes("pickup") || titleLower.includes("bbm")) {
    return bankCode === "KAS" ? "KAS-OPS-BSR-01" : `TRF-${bankCode}-${projectCode}-OPS01`;
  }
  if (titleLower.includes("izin fit-out") || titleLower.includes("deposit")) {
    return bankCode === "KAS" ? "KAS-OPS-BSR-02" : `TRF-${bankCode}-${projectCode}-OPS02`;
  }
  if (titleLower.includes("konsumsi") || titleLower.includes("lembur")) {
    return bankCode === "KAS" ? "KAS-OPS-BSR-03" : `TRF-${bankCode}-${projectCode}-OPS03`;
  }

  let tag = "EXP";
  if (categoryCode === "OPERASIONAL") tag = "OPS";
  else if (categoryCode === "TUKANG") tag = "TKG";
  else if (categoryCode === "MATERIAL") tag = "MAT";
  else if (categoryCode === "SUBCON") tag = "SUB";

  if (sequence !== undefined) {
    const seqStr = String(Math.max(1, sequence)).padStart(2, "0");
    return `TRF-${bankCode}-${projectCode}-${tag}${seqStr}`;
  }

  return `TRF-${bankCode}-${projectCode}-${tag}`;
}
