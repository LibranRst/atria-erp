import { readPrivateAttachment } from "@backend/server/usecases/media/private-attachments";
import { PRIVATE_ATTACHMENT_MAX_BYTES } from "@atria/core/media/private-attachment";
import { db } from "@backend/db";
import { aiRun } from "@backend/db/schema";
import { documentModel, requireDocumentProvider } from "@backend/lib/ai/document-model";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import { parseBankStatementCsv } from "@atria/core/finance/bank-statement-csv";
import { getErrorMessage } from "@atria/core/utils/error-message";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { z } from "zod";
import { statementMutationSchema } from "@atria/core/ai/bank-reconciliation";

export type AnalyzedBankStatementRow = {
  readonly rowNumber: number;
  readonly sheetName?: string;
  readonly transactionDate: string; // YYYY-MM-DD
  readonly description: string;
  readonly amount: number;
  readonly type: "INFLOW" | "OUTFLOW";
};

export type BankStatementAnalysisResult = {
  readonly rows: readonly AnalyzedBankStatementRow[];
  readonly detectedBankName: string | null;
  readonly detectedAccountNumber: string | null;
  readonly summary: {
    readonly totalInflow: number;
    readonly totalOutflow: number;
    readonly rowCount: number;
  };
};

export type AnalyzeBankStatementInput = {
  readonly fileName: string;
  readonly fileBase64?: string;
  readonly fileContent?: string;
  readonly fileUrl?: string;
  readonly mimeType?: string;
};

const aiBankRowSchema = z.object({
  transactionDate: z.string(),
  description: z.string(),
  amount: z.number().positive(),
  type: z.enum(["INFLOW", "OUTFLOW"]),
});

const aiBankAnalysisSchema = z.object({
  bankName: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  rows: z.array(aiBankRowSchema),
});

function parseAiBankAnalysis(rawJson: string): z.infer<typeof aiBankAnalysisSchema> {
  try {
    return aiBankAnalysisSchema.parse(JSON.parse(rawJson));
  } catch {
    throw new Error(
      "AI belum berhasil membaca struktur mutasi bank. Periksa dokumen atau isi manual.",
    );
  }
}

const INDONESIAN_MONTH_MAP: Record<string, string> = {
  jan: "01",
  januari: "01",
  feb: "02",
  februari: "02",
  mar: "03",
  maret: "03",
  apr: "04",
  april: "04",
  mei: "05",
  may: "05",
  jun: "06",
  juni: "06",
  jul: "07",
  juli: "07",
  agu: "08",
  ags: "08",
  agustus: "08",
  aug: "08",
  sep: "09",
  september: "09",
  okt: "10",
  oktober: "10",
  oct: "10",
  nov: "11",
  november: "11",
  des: "12",
  desember: "12",
  dec: "12",
};

/**
 * Menormalkan format tanggal beragam (DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, YYYY-MM-DD, 22 Jul 2026, dll.)
 * ke format standar ISO string tanggal: YYYY-MM-DD.
 */
export function normalizeDateToIso(rawDate: string): string {
  const trimmed = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY/MM/DD atau YYYY-MM-DD
  const ymdSlash = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(trimmed);
  if (ymdSlash) {
    const year = ymdSlash[1]!;
    const month = ymdSlash[2]!.padStart(2, "0");
    const day = ymdSlash[3]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY, DD/MM/YY, atau MM/DD/YY (jika part2 > 12)
  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    let day = "";
    let month = "";

    if (p2 > 12) {
      // Format M/D/Y (misal SheetJS output 7/22/26)
      day = String(p2).padStart(2, "0");
      month = String(p1).padStart(2, "0");
    } else {
      // Format D/M/Y (standar Indonesia 22/07/26 atau 01/08/26)
      day = String(p1).padStart(2, "0");
      month = String(p2).padStart(2, "0");
    }

    const rawYear = slashMatch[3]!;
    const year =
      rawYear.length === 2 ? (Number(rawYear) > 70 ? `19${rawYear}` : `20${rawYear}`) : rawYear;
    return `${year}-${month}-${day}`;
  }

  // DD Month YYYY atau DD-Month-YY (misal: 22 Jul 2026, 22-Juli-26, 05 Sept 2026)
  const textMonthMatch = /^(\d{1,2})[\s/-]+([a-zA-Z]+)[\s/-]+(\d{2,4})$/.exec(trimmed);
  if (textMonthMatch) {
    const day = textMonthMatch[1]!.padStart(2, "0");
    const monthKey = textMonthMatch[2]!.toLowerCase();
    const month = INDONESIAN_MONTH_MAP[monthKey];
    if (month) {
      const rawYear = textMonthMatch[3]!;
      const year =
        rawYear.length === 2 ? (Number(rawYear) > 70 ? `19${rawYear}` : `20${rawYear}`) : rawYear;
      return `${year}-${month}-${day}`;
    }
  }

  // Missing years must be supplied from the source, never guessed from today's date.
  const shortMatch = /^(\d{1,2})[/-](\d{1,2})$/.exec(trimmed);
  if (shortMatch) {
    throw new Error("Tanggal mutasi belum memiliki tahun. Lengkapi tahun dari rekening koran.");
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error("Tanggal mutasi tidak dapat dibaca. Periksa tanggal pada sumber.");
}

/**
 * Mem-parse nominal uang dalam format Indonesia (1.500.000,00) atau internasional (1,500,000.00).
 */
export function parseCurrencyNumber(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val !== "string") return null;
  let clean = val.trim();
  if (!clean || clean === "-" || clean === "--") return null;
  clean = clean.replace(/^(rp\.?|idr)\s*/i, "").trim();

  // Format Indonesia: titik ribuan, koma desimal (mis. 1.500.000,00 atau 1.500.000)
  if (/\.\d{3},\d{2}$/.test(clean) || /\.\d{3}$/.test(clean)) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{3}\.\d{2}$/.test(clean) || /,\d{3}$/.test(clean)) {
    // Format Internasional: koma ribuan, titik desimal (mis. 1,500,000.00)
    clean = clean.replace(/,/g, "");
  } else if (clean.includes(",") && !clean.includes(".")) {
    // Koma tunggal sebagai desimal (mis. 1500000,50)
    clean = clean.replace(",", ".");
  }

  const num = Number(clean.replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

/**
 * Menghitung ringkasan nominal dan jumlah baris mutasi bank.
 */
function calculateSummary(rows: readonly AnalyzedBankStatementRow[]): {
  totalInflow: number;
  totalOutflow: number;
  rowCount: number;
} {
  if (rows.length > 500)
    throw new Error("Maksimal 500 mutasi per berkas. Pecah sumber menjadi beberapa berkas.");
  for (const row of rows)
    statementMutationSchema.parse({
      transactionDate: row.transactionDate,
      description: row.description,
      amount: row.amount,
      type: row.type,
    });
  let totalInflow = 0;
  let totalOutflow = 0;

  for (const row of rows) {
    if (row.type === "INFLOW") {
      totalInflow += row.amount;
    } else {
      totalOutflow += row.amount;
    }
  }

  return {
    totalInflow,
    totalOutflow,
    rowCount: rows.length,
  };
}

/**
 * Mencoba mem-parse konten string sebagai CSV standar Atria.
 * Menghasilkan ParsedBankStatementRow[] jika cocok.
 */
function tryParseStandardAtriaCsv(content: string): AnalyzedBankStatementRow[] | null {
  try {
    const parsed = parseBankStatementCsv(content);
    return parsed.map((row) => ({
      rowNumber: row.rowNumber,
      transactionDate: row.transactionDate.toISOString().slice(0, 10),
      description: row.description,
      amount: Number(row.amount),
      type: row.type,
    }));
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      !error.message.startsWith("CSV_MISSING_HEADERS") &&
      !error.message.startsWith("CSV_EMPTY")
    )
      throw error;
    return null;
  }
}

/**
 * Mencoba mem-parse data tabular bank umum (BCA, Mandiri, BNI, BRI, dll.) secara lokal
 * dari baris 2D tanpa menggunakan token AI.
 */
export function tryParseGenericBankTabular(
  rawRows: unknown[][],
): BankStatementAnalysisResult | null {
  if (!rawRows || rawRows.length < 2) return null;

  let detectedBankName: string | null = null;
  let detectedAccountNumber: string | null = null;

  // 1. Deteksi metadata rekening dari baris-baris awal
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const rowText = (rawRows[i] ?? []).map((c) => String(c ?? "")).join(" ");
    const lower = rowText.toLowerCase();

    if (!detectedBankName) {
      if (lower.includes("bca") || lower.includes("bank central asia")) {
        detectedBankName = "BCA";
      } else if (lower.includes("mandiri") || lower.includes("bank mandiri")) {
        detectedBankName = "Mandiri";
      } else if (lower.includes("bni") || lower.includes("bank negara indonesia")) {
        detectedBankName = "BNI";
      } else if (lower.includes("bri") || lower.includes("bank rakyat indonesia")) {
        detectedBankName = "BRI";
      } else if (lower.includes("cimb") || lower.includes("niaga")) {
        detectedBankName = "CIMB Niaga";
      } else if (lower.includes("danamon")) {
        detectedBankName = "Danamon";
      }
    }

    if (!detectedAccountNumber) {
      const accMatch =
        /(?:no\.?\s*rekening|nomor\s*rekening|account\s*(?:no|number)|rekening)[\s:]*([0-9]{8,18})/i.exec(
          rowText,
        );
      if (accMatch?.[1]) {
        detectedAccountNumber = accMatch[1];
      }
    }
  }

  // 2. Cari baris header kolom
  let headerIndex = -1;
  let colDate = -1;
  let colDesc = -1;
  let colInflow = -1;
  let colOutflow = -1;
  let colAmount = -1;
  let colType = -1;

  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;

    let dCol = -1;
    let descCol = -1;
    let inCol = -1;
    let outCol = -1;
    let amtCol = -1;
    let typeCol = -1;

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? "")
        .trim()
        .toLowerCase();
      if (!val) continue;

      if (
        dCol === -1 &&
        (val === "tanggal" ||
          val === "tgl" ||
          val === "date" ||
          val === "trans date" ||
          val === "tanggal transaksi" ||
          val === "posting date")
      ) {
        dCol = c;
      } else if (
        descCol === -1 &&
        (val.includes("keterangan") ||
          val.includes("deskripsi") ||
          val.includes("uraian") ||
          val.includes("description") ||
          val.includes("narrative") ||
          val.includes("transaksi") ||
          val === "rincian")
      ) {
        descCol = c;
      } else if (
        inCol === -1 &&
        (val === "kredit" ||
          val === "credit" ||
          val === "cr" ||
          val === "masuk" ||
          val === "dana masuk" ||
          val === "inflow" ||
          val === "penerimaan")
      ) {
        inCol = c;
      } else if (
        outCol === -1 &&
        (val === "debit" ||
          val === "debet" ||
          val === "db" ||
          val === "keluar" ||
          val === "dana keluar" ||
          val === "outflow" ||
          val === "pengeluaran")
      ) {
        outCol = c;
      } else if (
        amtCol === -1 &&
        (val === "jumlah" ||
          val === "nominal" ||
          val === "amount" ||
          val === "nilai" ||
          val === "mutasi")
      ) {
        amtCol = c;
      } else if (
        typeCol === -1 &&
        (val === "tipe" ||
          val === "type" ||
          val === "d/k" ||
          val === "cr/db" ||
          val === "db/cr" ||
          val === "posisi")
      ) {
        typeCol = c;
      }
    }

    const hasDateAndDesc = dCol !== -1 && descCol !== -1;
    const hasInAndOut = inCol !== -1 && outCol !== -1;
    const hasAmount = amtCol !== -1;

    if (hasDateAndDesc && (hasInAndOut || hasAmount)) {
      headerIndex = i;
      colDate = dCol;
      colDesc = descCol;
      colInflow = inCol;
      colOutflow = outCol;
      colAmount = amtCol;
      colType = typeCol;
      break;
    }
  }

  if (headerIndex === -1) return null;

  // 3. Ekstrak data transaksi dari baris setelah header
  const parsedRows: AnalyzedBankStatementRow[] = [];

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;

    const rawDateVal = String(row[colDate] ?? "").trim();
    if (!rawDateVal) continue;

    // Abaikan baris ringkasan di bawah tabel (contoh: Total, Saldo Awal, Saldo Akhir)
    const lowerRawDate = rawDateVal.toLowerCase();
    if (
      lowerRawDate.includes("total") ||
      lowerRawDate.includes("saldo") ||
      lowerRawDate.includes("ending")
    ) {
      continue;
    }

    const rawDesc = String(row[colDesc] ?? "").trim();
    if (!rawDesc) continue;

    let amount = 0;
    let type: "INFLOW" | "OUTFLOW" = "INFLOW";
    let hasValidAmount = false;

    if (colInflow !== -1 && colOutflow !== -1) {
      const inVal = parseCurrencyNumber(row[colInflow]);
      const outVal = parseCurrencyNumber(row[colOutflow]);

      if (inVal && inVal > 0) {
        amount = inVal;
        type = "INFLOW";
        hasValidAmount = true;
      } else if (outVal && outVal > 0) {
        amount = outVal;
        type = "OUTFLOW";
        hasValidAmount = true;
      }
    } else if (colAmount !== -1) {
      const amtVal = parseCurrencyNumber(row[colAmount]);
      if (amtVal !== null && amtVal !== 0) {
        amount = Math.abs(amtVal);
        hasValidAmount = true;

        if (colType !== -1) {
          const typeStr = String(row[colType] ?? "")
            .trim()
            .toUpperCase();
          if (typeStr === "CR" || typeStr === "C" || typeStr === "KREDIT" || typeStr === "MASUK") {
            type = "INFLOW";
          } else if (
            typeStr === "DB" ||
            typeStr === "D" ||
            typeStr === "DEBIT" ||
            typeStr === "DEBET" ||
            typeStr === "KELUAR"
          ) {
            type = "OUTFLOW";
          } else {
            type = amtVal >= 0 ? "INFLOW" : "OUTFLOW";
          }
        } else {
          type = amtVal >= 0 ? "INFLOW" : "OUTFLOW";
        }
      }
    }

    if (hasValidAmount && amount > 0) {
      parsedRows.push({
        rowNumber: parsedRows.length + 1,
        transactionDate: normalizeDateToIso(rawDateVal),
        description: rawDesc,
        amount,
        type,
      });
    }
  }

  if (parsedRows.length === 0) return null;

  return {
    rows: parsedRows,
    detectedBankName,
    detectedAccountNumber,
    summary: calculateSummary(parsedRows),
  };
}

/**
 * Mengubah workbook Excel menjadi representasi teks CSV/baris untuk dianalisis,
 * memeriksa seluruh sheet untuk menemukan format transaksi standar atau umum.
 */
function extractExcelData(buffer: Buffer): {
  isParsedDirectly: boolean;
  directResult: BankStatementAnalysisResult | null;
  tabularText: string;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    return { isParsedDirectly: false, directResult: null, tabularText: "" };
  }

  const parsedSheets: BankStatementAnalysisResult[] = [];
  const textParts: string[] = [];
  let allParsed = true;
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: "," });
    if (!csvContent.trim()) continue;
    textParts.push(`Sheet: ${sheetName}\n${csvContent}`);
    const standardRows = tryParseStandardAtriaCsv(csvContent);
    const generic = standardRows
      ? {
          rows: standardRows,
          detectedBankName: null,
          detectedAccountNumber: null,
          summary: calculateSummary(standardRows),
        }
      : tryParseGenericBankTabular(
          XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            raw: false,
            dateNF: "yyyy-mm-dd",
          }),
        );
    if (!generic) {
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false });
      // A cover sheet has no transaction table. Unknown tabular sheets still enter full analysis.
      if (rawRows.some((row) => row.length > 1)) allParsed = false;
      continue;
    }
    parsedSheets.push({ ...generic, rows: generic.rows.map((row) => ({ ...row, sheetName })) });
  }
  const tabularText = textParts.join("\n\n");
  if (allParsed && parsedSheets.length) {
    const accounts = [
      ...new Set(
        parsedSheets.flatMap((s) => (s.detectedAccountNumber ? [s.detectedAccountNumber] : [])),
      ),
    ];
    if (accounts.length > 1)
      throw new Error("Spreadsheet memuat beberapa rekening. Pisahkan sumber per rekening.");
    const rows = parsedSheets.flatMap((s) => s.rows);
    return {
      isParsedDirectly: true,
      directResult: {
        rows,
        detectedBankName: parsedSheets.find((s) => s.detectedBankName)?.detectedBankName ?? null,
        detectedAccountNumber: accounts[0] ?? null,
        summary: calculateSummary(rows),
      },
      tabularText,
    };
  }
  if (tabularText.length > 32000)
    throw new Error(
      "Data spreadsheet terlalu panjang untuk dipetakan sekaligus. Pecah sumber tanpa menghilangkan sheet.",
    );
  return { isParsedDirectly: false, directResult: null, tabularText };
}

async function safeUpdateAiRun(
  runId: string | null | undefined,
  updates: { status: string; result?: string; errorMessage?: string },
): Promise<void> {
  if (!runId) return;
  try {
    await db.update(aiRun).set(updates).where(eq(aiRun.id, runId));
  } catch {
    // Abaikan jika DB tidak terhubung di unit test
  }
}

/**
 * Menganalisis file rekening koran (Excel, CSV non-standar, Gambar/PDF) menggunakan AI.
 */
export async function analyzeBankStatementUseCase(
  actor: Actor,
  input: AnalyzeBankStatementInput,
): Promise<ActionResponse<BankStatementAnalysisResult>> {
  let data = input;
  try {
    if (input.fileUrl) {
      const file = await readPrivateAttachment(actor, input.fileUrl, "bank_statement");
      const text =
        file.row.mimeType.startsWith("text/") || file.row.mimeType === "application/json";
      data = {
        fileName: file.row.fileName,
        mimeType: file.row.mimeType,
        fileContent: text ? file.bytes.toString("utf8") : undefined,
        fileBase64: text ? undefined : file.bytes.toString("base64"),
      };
    }
    if (
      (data.fileContent && Buffer.byteLength(data.fileContent) > PRIVATE_ATTACHMENT_MAX_BYTES) ||
      (data.fileBase64 &&
        Buffer.byteLength(data.fileBase64) > Math.ceil((PRIVATE_ATTACHMENT_MAX_BYTES * 4) / 3) + 4)
    ) {
      throw new Error("Ukuran berkas melebihi 10 MB.");
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Lampiran tidak valid.",
      },
    };
  }
  const fileNameLower = data.fileName.toLowerCase();
  const isExcel =
    fileNameLower.endsWith(".xlsx") ||
    fileNameLower.endsWith(".xls") ||
    Boolean(data.mimeType?.includes("spreadsheet") || data.mimeType?.includes("excel"));
  const isCsv =
    fileNameLower.endsWith(".csv") ||
    fileNameLower.endsWith(".txt") ||
    Boolean(data.mimeType === "text/csv" || data.mimeType?.startsWith("text/"));
  const isImageOrPdf =
    fileNameLower.endsWith(".pdf") ||
    fileNameLower.endsWith(".png") ||
    fileNameLower.endsWith(".jpg") ||
    fileNameLower.endsWith(".jpeg") ||
    fileNameLower.endsWith(".webp") ||
    Boolean(data.mimeType?.startsWith("image/") || data.mimeType === "application/pdf");

  // Catat run di ai_run secara aman
  let runLog: { id: string } | null = null;
  try {
    const [inserted] = await db
      .insert(aiRun)
      .values({
        runType: "ANALYZE_BANK_STATEMENT",
        runById: actor.userId,
        status: "PROCESSING",
        payload: JSON.stringify({
          fileName: data.fileName,
          mimeType: data.mimeType,
          hasBase64: Boolean(data.fileBase64),
          hasContent: Boolean(data.fileContent),
          hasUrl: Boolean(data.fileUrl),
        }),
        createdAt: new Date(),
      })
      .returning();
    runLog = inserted ?? null;
  } catch {
    // Abaikan jika database tidak terhubung di lingkungan uji unit
  }

  try {
    // Jalur 1: File CSV langsung (Cek format standar Atria atau format bank umum tanpa token)
    if (isCsv && data.fileContent) {
      const standardRows = tryParseStandardAtriaCsv(data.fileContent);
      if (standardRows && standardRows.length > 0) {
        const result: BankStatementAnalysisResult = {
          rows: standardRows,
          detectedBankName: null,
          detectedAccountNumber: null,
          summary: calculateSummary(standardRows),
        };

        await safeUpdateAiRun(runLog?.id, {
          status: "COMPLETED",
          result: JSON.stringify({ rowCount: standardRows.length, engine: "STANDARD_CSV" }),
        });

        return { success: true, data: result };
      }

      // Coba parse CSV dengan format bank umum (BCA, Mandiri, BRI, BNI) secara lokal
      try {
        const wb = XLSX.read(data.fileContent, { type: "string" });
        const sheetName = wb.SheetNames[0];
        const sheet = sheetName ? wb.Sheets[sheetName] : null;
        if (sheet) {
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            raw: false,
          });
          const genericResult = tryParseGenericBankTabular(rawRows);
          if (genericResult && genericResult.rows.length > 0) {
            await safeUpdateAiRun(runLog?.id, {
              status: "COMPLETED",
              result: JSON.stringify({
                rowCount: genericResult.rows.length,
                engine: "GENERIC_CSV",
              }),
            });
            return { success: true, data: genericResult };
          }
        }
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.startsWith("Maksimal 500") || error.message.startsWith("Tanggal mutasi"))
        )
          throw error;
        // Lanjutkan ke AI jika parsing lokal gagal
      }
    }

    // Jalur 2: File Excel (.xlsx/.xls)
    let excelBuffer: Buffer | null = null;
    if (isExcel) {
      if (data.fileBase64) {
        excelBuffer = Buffer.from(data.fileBase64, "base64");
      } else if (data.fileUrl) {
        const res = await fetch(data.fileUrl);
        if (!res.ok) throw new Error("Gagal mengunduh file Excel dari storage.");
        excelBuffer = Buffer.from(await res.arrayBuffer());
      }
    }

    if (excelBuffer) {
      const { isParsedDirectly, directResult, tabularText } = extractExcelData(excelBuffer);
      if (isParsedDirectly && directResult && directResult.rows.length > 0) {
        await safeUpdateAiRun(runLog?.id, {
          status: "COMPLETED",
          result: JSON.stringify({
            rowCount: directResult.rows.length,
            engine: "DIRECT_EXCEL",
          }),
        });

        return { success: true, data: directResult };
      }

      // Jika format Excel tidak standar, kirim representasi teks ke AI
      const prompt = `Berikut adalah data rekening koran bank yang diekstrak dari spreadsheet Excel.
Petakan data ini menjadi daftar baris mutasi bank yang terstandarisasi:
1. transactionDate: YYYY-MM-DD
2. description: keterangan lengkap transaksi
3. amount: nominal transaksi dalam rupiah (angka positif)
4. type: "INFLOW" jika dana masuk/kredit/CR, atau "OUTFLOW" jika dana keluar/debit/DB
5. bankName: nama bank jika tertera (misal: BCA, Mandiri, BRI, BNI)
6. accountNumber: nomor rekening jika tertera

Data tabular:
${tabularText}`;

      requireDocumentProvider();
      const response = await documentModel.models.generateContent({
        contents: [prompt],
        config: {
          abortSignal: AbortSignal.timeout(40_000),
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              bankName: { type: ["string", "null"] },
              accountNumber: { type: ["string", "null"] },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    transactionDate: { type: "string", description: "Format YYYY-MM-DD" },
                    description: { type: "string" },
                    amount: { type: "number", description: "Nominal positif" },
                    type: { type: "string", enum: ["INFLOW", "OUTFLOW"] },
                  },
                  required: ["transactionDate", "description", "amount", "type"],
                },
              },
            },
            required: ["rows"],
          },
        },
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("AI mengembalikan respons kosong.");

      const parsed = parseAiBankAnalysis(rawJson);
      const formattedRows: AnalyzedBankStatementRow[] = parsed.rows.map((row, index) => ({
        rowNumber: index + 1,
        transactionDate: normalizeDateToIso(row.transactionDate),
        description: row.description.trim(),
        amount: Math.abs(row.amount),
        type: row.type,
      }));

      const result: BankStatementAnalysisResult = {
        rows: formattedRows,
        detectedBankName: parsed.bankName ?? null,
        detectedAccountNumber: parsed.accountNumber ?? null,
        summary: calculateSummary(formattedRows),
      };

      await safeUpdateAiRun(runLog?.id, {
        status: "COMPLETED",
        result: JSON.stringify({ rowCount: formattedRows.length, engine: "AI_EXCEL" }),
      });

      return { success: true, data: result };
    }

    // Jalur 3: CSV non-standar atau teks bebas
    if (isCsv && data.fileContent) {
      if (data.fileContent.length > 32000)
        throw new Error("Data teks terlalu panjang. Pecah sumber menjadi beberapa berkas.");
      const prompt = `Berikut adalah data mutasi rekening koran dari file CSV atau teks:
Petakan data ini menjadi daftar baris mutasi bank yang terstandarisasi:
1. transactionDate: YYYY-MM-DD
2. description: keterangan transaksi
3. amount: nominal dalam rupiah (angka positif)
4. type: "INFLOW" jika dana masuk/kredit/CR, atau "OUTFLOW" jika dana keluar/debit/DB
5. bankName: nama bank jika tertera (misal: BCA, Mandiri, BRI, BNI)
6. accountNumber: nomor rekening jika tertera

Isi teks/CSV:
${data.fileContent}`;

      requireDocumentProvider();
      const response = await documentModel.models.generateContent({
        contents: [prompt],
        config: {
          abortSignal: AbortSignal.timeout(40_000),
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              bankName: { type: ["string", "null"] },
              accountNumber: { type: ["string", "null"] },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    transactionDate: { type: "string", description: "Format YYYY-MM-DD" },
                    description: { type: "string" },
                    amount: { type: "number", description: "Nominal positif" },
                    type: { type: "string", enum: ["INFLOW", "OUTFLOW"] },
                  },
                  required: ["transactionDate", "description", "amount", "type"],
                },
              },
            },
            required: ["rows"],
          },
        },
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("AI mengembalikan respons kosong.");

      const parsed = parseAiBankAnalysis(rawJson);
      const formattedRows: AnalyzedBankStatementRow[] = parsed.rows.map((row, index) => ({
        rowNumber: index + 1,
        transactionDate: normalizeDateToIso(row.transactionDate),
        description: row.description.trim(),
        amount: Math.abs(row.amount),
        type: row.type,
      }));

      const result: BankStatementAnalysisResult = {
        rows: formattedRows,
        detectedBankName: parsed.bankName ?? null,
        detectedAccountNumber: parsed.accountNumber ?? null,
        summary: calculateSummary(formattedRows),
      };

      await safeUpdateAiRun(runLog?.id, {
        status: "COMPLETED",
        result: JSON.stringify({ rowCount: formattedRows.length, engine: "AI_CSV" }),
      });

      return { success: true, data: result };
    }

    // Jalur 4: Gambar / Dokumen PDF (Multimodal)
    if (isImageOrPdf) {
      let base64Data = data.fileBase64;
      let detectedMime = data.mimeType || "image/jpeg";

      if (!base64Data && data.fileUrl) {
        const res = await fetch(data.fileUrl);
        if (!res.ok) throw new Error("Gagal mengunduh berkas mutasi dari CDN.");
        const buffer = await res.arrayBuffer();
        base64Data = Buffer.from(buffer).toString("base64");
        detectedMime = res.headers.get("content-type") || detectedMime;
      }

      if (!base64Data) {
        throw new Error("Data berkas gambar/PDF rekening koran tidak tersedia.");
      }

      const prompt = `Ekstrak seluruh baris transaksi rekening koran / mutasi bank dari bukti transaksi/dokumen ini.
Pastikan:
1. transactionDate berformat YYYY-MM-DD.
2. description adalah keterangan transaksi lengkap.
3. amount adalah nominal positif tanpa simbol mata uang.
4. type bernilai "INFLOW" jika dana masuk (kredit/CR) atau "OUTFLOW" jika dana keluar (debet/DB).
5. Deteksi nama bank (contoh: BCA, Mandiri, BRI, BNI) dan nomor rekening jika terlihat pada dokumen.`;

      requireDocumentProvider();
      const response = await documentModel.models.generateContent({
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: detectedMime,
            },
          },
          prompt,
        ],
        config: {
          abortSignal: AbortSignal.timeout(40_000),
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              bankName: { type: ["string", "null"] },
              accountNumber: { type: ["string", "null"] },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    transactionDate: { type: "string", description: "Format YYYY-MM-DD" },
                    description: { type: "string" },
                    amount: { type: "number", description: "Nominal positif" },
                    type: { type: "string", enum: ["INFLOW", "OUTFLOW"] },
                  },
                  required: ["transactionDate", "description", "amount", "type"],
                },
              },
            },
            required: ["rows"],
          },
        },
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("AI mengembalikan respons kosong.");

      const parsed = parseAiBankAnalysis(rawJson);
      const formattedRows: AnalyzedBankStatementRow[] = parsed.rows.map((row, index) => ({
        rowNumber: index + 1,
        transactionDate: normalizeDateToIso(row.transactionDate),
        description: row.description.trim(),
        amount: Math.abs(row.amount),
        type: row.type,
      }));

      const result: BankStatementAnalysisResult = {
        rows: formattedRows,
        detectedBankName: parsed.bankName ?? null,
        detectedAccountNumber: parsed.accountNumber ?? null,
        summary: calculateSummary(formattedRows),
      };

      await safeUpdateAiRun(runLog?.id, {
        status: "COMPLETED",
        result: JSON.stringify({ rowCount: formattedRows.length, engine: "AI_MULTIMODAL" }),
      });

      return { success: true, data: result };
    }

    throw new Error(
      "Format berkas tidak didukung. Unggah file spreadsheet (CSV, Excel), dokumen PDF, atau gambar mutasi bank.",
    );
  } catch (error) {
    const message = getErrorMessage(error, "Gagal menganalisis berkas rekening koran.");
    await safeUpdateAiRun(runLog?.id, {
      status: "FAILED",
      errorMessage: message,
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message,
      },
    };
  }
}
