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

