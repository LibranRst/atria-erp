export type CsvTable = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

export function parseCsvTable(source: string): CsvTable {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

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
    if (character === "," && !quoted) {
      record.push(field.trim());
      field = "";
      continue;
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field.trim());
      field = "";
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      continue;
    }
    field += character;
  }
  if (quoted) throw new Error("CSV memiliki tanda kutip yang belum ditutup.");
  record.push(field.trim());
  if (record.some((value) => value.length > 0)) records.push(record);
  const [headers = [], ...rows] = records;
  return {
    headers: headers.map((header) => header.trim().toLocaleLowerCase("id-ID")),
    rows,
  };
}

/** Strict operational imports must not silently shift or discard source cells. */
export function parseStrictCsvTable(source: string): CsvTable {
  const table = parseCsvTable(source);
  const headers = new Set<string>();
  for (const header of table.headers) {
    if (headers.has(header)) throw new Error(`Kolom CSV duplikat: ${header || "tanpa nama"}.`);
    headers.add(header);
  }
  for (const [index, row] of table.rows.entries()) {
    if (row.length !== table.headers.length)
      throw new Error(
        `Baris ${index + 2}: jumlah kolom tidak sesuai header (${row.length} dari ${table.headers.length}). Periksa pemisah dan gunakan tanda kutip untuk nilai yang mengandung koma.`,
      );
  }
  return table;
}
