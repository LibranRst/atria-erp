import { parseStrictCsvTable } from "./csv";

export interface MaterialCatalogCsvRow {
  readonly rowNumber: number;
  readonly name: string;
  readonly categoryName: string;
  readonly unit: string;
  readonly locationName: string;
  readonly minimumStock: number;
  readonly lastPurchasePrice: number;
  readonly vendorName: string;
  readonly specification: string;
  readonly brand: string;
  readonly code: string;
  readonly color: string;
}
export interface MaterialCatalogCsvInput {
  readonly rows: MaterialCatalogCsvRow[];
}
export interface OpeningInventoryCsvRow {
  readonly rowNumber: number;
  readonly materialName: string;
  readonly materialCode: string;
  readonly locationName: string;
  readonly quantity: number;
  readonly unitCost: number;
}
export interface OpeningInventoryCsvInput {
  readonly rows: OpeningInventoryCsvRow[];
}

export const MATERIAL_CATALOG_CSV_TEMPLATE =
  "name,category,unit,location,minimum_stock,last_purchase_price,vendor,specification,brand,code,color\nMultipleks 18mm,Panel,lembar,Gudang Utama,2,250000,Vendor Utama,18mm,Brand,PLY-18,Natural\n";
export const OPENING_INVENTORY_CSV_TEMPLATE =
  "material_name,material_code,location_name,quantity,unit_cost\nMultipleks 18mm,PLY-18,Gudang Utama,10,250000\n";

export function parseMaterialCatalogCsv(source: string): MaterialCatalogCsvInput {
  const table = parseStrictCsvTable(source);
  const index = (name: string): number => table.headers.indexOf(name);
  const required = ["name", "category", "unit", "location"];
  const missing = required.filter((header) => index(header) < 0);
  if (missing.length > 0) throw new Error(`Header wajib belum ada: ${missing.join(", ")}.`);
  const value = (row: readonly string[], name: string): string =>
    index(name) >= 0 ? (row[index(name)] ?? "") : "";
  const numberValue = (row: readonly string[], name: string): number => {
    const parsed = Number(value(row, name) || 0);
    return Number.isFinite(parsed) ? parsed : -1;
  };
  return {
    rows: table.rows.map((row, rowIndex) => ({
      rowNumber: rowIndex + 2,
      name: value(row, "name"),
      categoryName: value(row, "category"),
      unit: value(row, "unit"),
      locationName: value(row, "location"),
      minimumStock: numberValue(row, "minimum_stock"),
      lastPurchasePrice: numberValue(row, "last_purchase_price"),
      vendorName: value(row, "vendor"),
      specification: value(row, "specification"),
      brand: value(row, "brand"),
      code: value(row, "code"),
      color: value(row, "color"),
    })),
  };
}

export function parseOpeningInventoryCsv(source: string): OpeningInventoryCsvInput {
  const table = parseStrictCsvTable(source);
  const index = (name: string): number => table.headers.indexOf(name);
  const missing = ["location_name", "quantity", "unit_cost"].filter((header) => index(header) < 0);
  if (missing.length > 0 || (index("material_name") < 0 && index("material_code") < 0))
    throw new Error(
      "Header wajib: material_name atau material_code, location_name, quantity, unit_cost.",
    );
  return {
    rows: table.rows.map((row, rowIndex) => ({
      rowNumber: rowIndex + 2,
      materialName: index("material_name") >= 0 ? (row[index("material_name")] ?? "") : "",
      materialCode: index("material_code") >= 0 ? (row[index("material_code")] ?? "") : "",
      locationName: row[index("location_name")] ?? "",
      quantity: Number.isFinite(Number(row[index("quantity")] ?? 0))
        ? Number(row[index("quantity")] ?? 0)
        : 0,
      unitCost: Number.isFinite(Number(row[index("unit_cost")] ?? 0))
        ? Number(row[index("unit_cost")] ?? 0)
        : 0,
    })),
  };
}
