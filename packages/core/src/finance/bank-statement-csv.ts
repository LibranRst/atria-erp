import type { CashDirection } from "./cash-direction";
import { fromCents, parseNumericToCents } from "./money-minor";

export type ParsedBankStatementRow = {
  readonly rowNumber: number;
  readonly transactionDate: Date;
  readonly description: string;
  readonly amount: string;
  readonly type: CashDirection;
};

const REQUIRED_HEADERS = ["tanggal", "deskripsi", "dana_masuk", "dana_keluar"] as const;

function detectDelimiter(content: string): "," | ";" {
  const firstLine = content.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];
    if (character === '"') quoted = !quoted;
    if (!quoted && character === ",") commas += 1;
    if (!quoted && character === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

function parseCsvRecords(content: string, delimiter: "," | ";"): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  const source = content.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      record.push(field.trim());
      field = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field.trim());
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      field = "";
      continue;
    }
    field += character;
  }

  if (quoted) throw new Error("CSV_INVALID_QUOTES: Tanda kutip pada file CSV tidak lengkap.");
  record.push(field.trim());
  if (record.some((value) => value.length > 0)) records.push(record);
  return records;
}

function parseDate(value: string, rowNumber: number): Date {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const localMatch = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : localMatch
      ? {
          year: Number(localMatch[3]),
          month: Number(localMatch[2]),
          day: Number(localMatch[1]),
        }
      : null;
  if (!parts) {
    throw new Error(
      `CSV_INVALID_DATE: Baris ${rowNumber}: tanggal harus YYYY-MM-DD atau DD/MM/YYYY.`,
    );
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    throw new Error(`CSV_INVALID_DATE: Baris ${rowNumber}: tanggal tidak valid.`);
  }
  return date;
}

function parseRupiah(value: string, rowNumber: number, header: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const source = trimmed.replace(/^rp\.?\s*/i, "").trim();
  if (source.startsWith("-") || source.startsWith("(")) {
    throw new Error(`CSV_INVALID_AMOUNT: Baris ${rowNumber}: ${header} tidak boleh negatif.`);
  }
  const indonesianDecimal = /^(\d+|\d{1,3}(?:\.\d{3})+),(\d{1,2})$/.exec(source);
  const canonicalDecimal = /^(\d+)\.(\d{1,2})$/.exec(source);
  const internationalDecimal = /^(\d{1,3}(?:,\d{3})+)\.(\d{1,2})$/.exec(source);
  const decimal = indonesianDecimal ?? canonicalDecimal ?? internationalDecimal;
  let normalized: string;
  if (decimal?.[1] !== undefined && decimal[2] !== undefined) {
    normalized = `${decimal[1].replace(/[.,]/g, "")}.${decimal[2]}`;
  } else if (/^\d+$/.test(source)) {
    normalized = source;
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(source) || /^\d{1,3}(?:,\d{3})+$/.test(source)) {
    normalized = source.replace(/[.,]/g, "");
  } else {
    throw new Error(`CSV_INVALID_AMOUNT: Baris ${rowNumber}: format ${header} tidak valid.`);
  }
  const amount = parseNumericToCents(normalized);
  if (amount <= 0n) {
    throw new Error(`CSV_INVALID_AMOUNT: Baris ${rowNumber}: ${header} harus lebih dari nol.`);
  }
  return fromCents(amount);
}

export function parseBankStatementCsv(content: string): readonly ParsedBankStatementRow[] {
  const records = parseCsvRecords(content, detectDelimiter(content));
  const header = records[0]?.map((value) => value.trim().toLocaleLowerCase("id-ID"));
  if (!header) throw new Error("CSV_EMPTY: File rekening koran kosong.");
  const indexes = new Map(header.map((value, index) => [value, index]));
  const missing = REQUIRED_HEADERS.filter((name) => !indexes.has(name));
  if (missing.length > 0) {
    throw new Error(`CSV_MISSING_HEADERS: Kolom wajib belum ada: ${missing.join(", ")}.`);
  }
  const duplicates = header.filter((name, index) => header.indexOf(name) !== index);
  if (duplicates.length > 0)
    throw new Error(
      `CSV_DUPLICATE_HEADERS: Nama kolom berulang: ${[...new Set(duplicates)].map((name) => name || "tanpa nama").join(", ")}.`,
    );

  const rows = records.slice(1).map((record, index) => {
    const rowNumber = index + 2;
    if (record.length !== header.length)
      throw new Error(
        `CSV_INVALID_ROW_WIDTH: Baris ${rowNumber}: jumlah kolom harus ${header.length}, ditemukan ${record.length}. Periksa pemisah dan tanda kutip.`,
      );
    const value = (name: (typeof REQUIRED_HEADERS)[number]): string =>
      record[indexes.get(name) ?? -1]?.trim() ?? "";
    const description = value("deskripsi");
    if (description.length < 3 || description.length > 500) {
      throw new Error(
        `CSV_INVALID_DESCRIPTION: Baris ${rowNumber}: deskripsi harus 3–500 karakter.`,
      );
    }
    const inflow = parseRupiah(value("dana_masuk"), rowNumber, "dana_masuk");
    const outflow = parseRupiah(value("dana_keluar"), rowNumber, "dana_keluar");
    if (Boolean(inflow) === Boolean(outflow)) {
      throw new Error(
        `CSV_INVALID_DIRECTION: Baris ${rowNumber}: isi tepat satu dari dana_masuk atau dana_keluar.`,
      );
    }
    return {
      rowNumber,
      transactionDate: parseDate(value("tanggal"), rowNumber),
      description,
      amount: inflow ?? outflow ?? "0.00",
      type: inflow ? ("INFLOW" as const) : ("OUTFLOW" as const),
    };
  });

  if (rows.length === 0) throw new Error("CSV_NO_ROWS: File tidak memiliki baris transaksi.");
  if (rows.length > 500) throw new Error("CSV_TOO_MANY_ROWS: Maksimal 500 transaksi per file.");
  return rows;
}
