import { z } from "zod";
import {
  materialFieldsSchema,
  type MaterialFields,
  type MaterialSource,
} from "@atria/core/ai/material-import";

const aliases: Readonly<Record<string, keyof MaterialFields>> = {
  name: "name",
  nama: "name",
  material: "name",
  namamaterial: "name",
  materialname: "name",
  namabarang: "name",
  category: "categoryName",
  categoryname: "categoryName",
  kategori: "categoryName",
  kategorimaterial: "categoryName",
  unit: "unit",
  satuan: "unit",
  uom: "unit",
  location: "locationName",
  locationname: "locationName",
  lokasi: "locationName",
  gudang: "locationName",
  vendor: "vendorName",
  vendorname: "vendorName",
  supplier: "vendorName",
  namavendor: "vendorName",
  withoutvendor: "withoutVendor",
  tanpavendor: "withoutVendor",
  specification: "specification",
  spesifikasi: "specification",
  specs: "specification",
  spec: "specification",
  brand: "brand",
  merek: "brand",
  merk: "brand",
  code: "code",
  kode: "code",
  kodematerial: "code",
  sku: "code",
  color: "color",
  warna: "color",
  minimumstock: "minimumStock",
  minimumstok: "minimumStock",
  stokminimum: "minimumStock",
  minimum_stock: "minimumStock",
  minstock: "minimumStock",
  lastpurchaseprice: "lastPurchasePrice",
  lastpurchasepricerp: "lastPurchasePrice",
  last_purchase_price: "lastPurchasePrice",
  harga: "lastPurchasePrice",
  price: "lastPurchasePrice",
  hargaacuan: "lastPurchasePrice",
  hargaacuanrp: "lastPurchasePrice",
  hargareferensi: "lastPurchasePrice",
  hargareferensirp: "lastPurchasePrice",
  hargasatuan: "lastPurchasePrice",
  hargasatuanrp: "lastPurchasePrice",
};
export function materialColumnField(header: unknown): keyof MaterialFields | undefined {
  const key = String(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return Object.hasOwn(aliases, key) ? aliases[key] : undefined;
}
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Cell = z.infer<typeof scalar>;
function amount(value: Cell | undefined, money: boolean): { value: number; uncertain: boolean } {
  if (value === undefined || value === null || value === "") return { value: 0, uncertain: false };
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0
      ? { value, uncertain: false }
      : { value: 0, uncertain: true };
  if (typeof value !== "string") return { value: 0, uncertain: true };
  const text = value
    .trim()
    .replace(/^rp\.?\s*/i, "")
    .replace(/\s/g, "");
  let normalized = text;
  let uncertain = false;
  if (/^\d+$/.test(text) || /^0[.,]\d+$/.test(text)) normalized = text.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
    uncertain = !money && (text.match(/[.,]/g)?.length ?? 0) === 1;
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text)) {
    normalized = text.replace(/,/g, "");
    uncertain = !money && (text.match(/[.,]/g)?.length ?? 0) === 1;
  } else if (/^\d+[.,]\d{1,2}$/.test(text)) normalized = text.replace(",", ".");
  else return { value: 0, uncertain: true };
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0
    ? { value: parsed, uncertain }
    : { value: 0, uncertain: true };
}
export function structuredMaterialSource(
  source: MaterialSource,
  options?: { readonly withoutVendor?: boolean },
): { fields: MaterialFields; uncertain: boolean } | null {
  if (!source.raw.startsWith("Kolom: ")) return null;
  const boundary = source.raw.indexOf("\nData: ");
  if (boundary < 0) return null;
  let headers: unknown;
  let values: unknown;
  try {
    headers = JSON.parse(source.raw.slice(7, boundary));
    values = JSON.parse(source.raw.slice(boundary + 7));
  } catch {
    return null;
  }
  const parsedHeaders = z.array(scalar).safeParse(headers);
  const parsedValues = z.array(scalar).safeParse(values);
  if (!parsedHeaders.success || !parsedValues.success) return null;
  const cells = new Map<keyof MaterialFields, Cell>();
  for (const [index, header] of parsedHeaders.data.entries()) {
    const field = materialColumnField(header);
    if (!field) continue;
    if (cells.has(field)) return null;
    cells.set(field, parsedValues.data[index] ?? "");
  }
  const required: readonly (keyof MaterialFields)[] = [
    "name",
    "categoryName",
    "unit",
    "locationName",
  ];
  if (!required.every((field) => cells.has(field))) return null;
  const text = (field: keyof MaterialFields): string => String(cells.get(field) ?? "").trim();
  const price = amount(cells.get("lastPurchasePrice"), true);
  const minimum = amount(cells.get("minimumStock"), false);
  const noVendor = text("withoutVendor").toLowerCase();
  const trueValues = ["ya", "yes", "true", "1"];
  const falseValues = ["tidak", "no", "false", "0"];
  const vendorText = text("vendorName");
  const explicitEmptyVendor = /^(tanpa vendor|without vendor|no vendor)$/i.test(vendorText);
  const withoutVendor =
    options?.withoutVendor === true ||
    trueValues.includes(noVendor) ||
    (explicitEmptyVendor && !falseValues.includes(noVendor));
  const vendorName = options?.withoutVendor === true || explicitEmptyVendor ? "" : vendorText;
  const uncertain =
    price.uncertain ||
    minimum.uncertain ||
    (noVendor !== "" && !trueValues.includes(noVendor) && !falseValues.includes(noVendor)) ||
    (!vendorName && !withoutVendor) ||
    (withoutVendor && Boolean(vendorName)) ||
    (options?.withoutVendor !== true && explicitEmptyVendor && falseValues.includes(noVendor));
  const parsed = materialFieldsSchema.safeParse({
    name: text("name"),
    categoryName: text("categoryName"),
    unit: text("unit"),
    locationName: text("locationName"),
    vendorName,
    withoutVendor,
    specification: text("specification"),
    brand: text("brand"),
    code: text("code"),
    color: text("color"),
    minimumStock: minimum.value,
    lastPurchasePrice: price.value,
  });
  return parsed.success ? { fields: parsed.data, uncertain } : null;
}
export function hasMaterialFieldInstructions(context: unknown): boolean {
  const parsed = z
    .object({ userRequest: z.string().default("") })
    .passthrough()
    .safeParse(context);
  if (parsed.success && /\b(?:kecuali|selain|except|but)\b/i.test(parsed.data.userRequest))
    return true;
  const request = parsed.success
    ? parsed.data.userRequest
        .replace(/\b(?:semua|seluruh|all)\s+(?:tanpa vendor|without vendor)\b/gi, "")
        .replace(
          /\bharga\s+(?:memakai|menggunakan|dalam)\s+format\s+(?:rupiah|angka)\s+Indonesia\b/gi,
          "",
        )
        .replace(
          /\b(?:kategori|lokasi)(?:\s+dan\s+(?:kategori|lokasi))?\s+belum\s+(?:saya\s+)?(?:pastikan|dipastikan|ditentukan|diketahui)\b/gi,
          "",
        )
        .replace(/\bjangan\s+(?:buat|membuat|mendaftarkan)\s+referensi\s+baru\b/gi, "")
        .replace(/\bjangan\s+(?:simpan|menyimpan)(?:\s+(?:material|data|otomatis|dulu))*\b/gi, "")
    : "";
  return (
    !parsed.success ||
    /\b(kategori|category|lokasi|location|satuan|unit|vendor|supplier|harga|price|minimum|stok|stock|merek|brand|kode|code|warna|color|nama|name|ubah|ganti|change|replace|gunakan|pakai|use|set|jadikan|jangan)\b/i.test(
      request,
    )
  );
}
export function mappedStructuredMaterialSource(
  source: MaterialSource,
  context: unknown,
): { fields: MaterialFields; uncertain: boolean } | null {
  if (hasMaterialFieldInstructions(context)) return null;
  const parsed = z
    .object({ userRequest: z.string().default("") })
    .passthrough()
    .safeParse(context);
  return structuredMaterialSource(source, {
    withoutVendor:
      parsed.success &&
      /\b(?:semua|seluruh|all)\s+(?:tanpa vendor|without vendor)\b/i.test(parsed.data.userRequest),
  });
}

/** Recognized pipe/TSV tables are data rows; surrounding prose is not a candidate. */
export function textTableMaterialSources(
  text: string,
  fileName: string,
  attachmentUrl: string,
): MaterialSource[] | null {
  const result: MaterialSource[] = [];
  let headers: string[] | null = null,
    delimiter: "|" | "\t" | null = null;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      headers = null;
      delimiter = null;
      continue;
    }
    const separator = line.includes("\t") ? "\t" : line.includes("|") ? "|" : null;
    if (!separator) {
      headers = null;
      delimiter = null;
      continue;
    }
    const values = line.split(separator);
    const framed = separator === "|" && line.trim().startsWith("|") && line.trim().endsWith("|");
    if (framed) {
      values.shift();
      values.pop();
    }
    const fields = new Set(values.map(materialColumnField).filter(Boolean));
    if (
      fields.has("name") &&
      fields.has("unit") &&
      fields.has("categoryName") &&
      fields.has("locationName")
    ) {
      headers = values;
      delimiter = separator;
      continue;
    }
    if (values.every((value) => /^\s*:?-{2,}:?\s*$/.test(value))) continue;
    if (!headers || delimiter !== separator || values.length !== headers.length) return null;
    result.push({
      attachmentUrl,
      fileName,
      row: index + 1,
      raw: `Kolom: ${JSON.stringify(headers)}\nData: ${JSON.stringify(values)}`,
    });
  }
  return result.length ? result : null;
}
/** Upgrade an unprocessed text checkpoint; completed candidate checkpoints are never reinterpreted. */
export function normalizedTextMaterialSources(
  sources: readonly MaterialSource[],
): MaterialSource[] {
  const result: MaterialSource[] = [];
  const handled = new Set<string>();
  for (const source of sources) {
    if (!source.attachmentUrl || !/\.(txt|md|markdown)$/i.test(source.fileName ?? "")) {
      result.push(source);
      continue;
    }
    if (handled.has(source.attachmentUrl)) continue;
    handled.add(source.attachmentUrl);
    const group = sources.filter((row) => row.attachmentUrl === source.attachmentUrl);
    const table = group.some((row) => row.raw.startsWith("Kolom: "))
      ? null
      : textTableMaterialSources(
          group.map((row) => row.raw).join("\n"),
          source.fileName ?? "",
          source.attachmentUrl,
        );
    result.push(
      ...(table?.map((row) => ({ ...row, row: group[row.row - 1]?.row ?? row.row })) ?? group),
    );
  }
  return result;
}
export function materialSourceChunk(
  sources: readonly MaterialSource[],
  context: unknown,
): MaterialSource[] {
  const chunk: MaterialSource[] = [];
  let characters = 0,
    modelRows = 0;
  const instructions = hasMaterialFieldInstructions(context);
  for (const source of sources.slice(0, 20)) {
    if (source.raw.length > 32000)
      throw new RangeError(
        `Baris ${source.row} terlalu panjang. Pisahkan sumber sebelum menganalisis.`,
      );
    const requiresModel = instructions || !mappedStructuredMaterialSource(source, context);
    if (characters + source.raw.length > 32000 || (requiresModel && modelRows >= 5)) break;
    chunk.push(source);
    characters += source.raw.length;
    if (requiresModel) modelRows++;
  }
  return chunk;
}
