import { parseCsvTable } from "@/lib/import/csv";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { MaterialTone } from "@/features/materials/components/shared/material-page-primitives";

export type DraftLine = {
  readonly key: string;
  readonly materialInventoryId: string;
  readonly quantity: string;
  readonly unitCost: string;
};
export type Metadata = {
  readonly balanceDate: string;
  readonly referenceNumber: string;
  readonly note: string;
};
export type EntryMode = "MANUAL" | "CSV";
export const EMPTY_METADATA: Metadata = { balanceDate: "", referenceNumber: "", note: "" };
export function newLine(materialInventoryId = ""): DraftLine {
  return { key: crypto.randomUUID(), materialInventoryId, quantity: "", unitCost: "" };
}
export function statusPresentation(status: string): {
  readonly label: string;
  readonly tone: MaterialTone;
} {
  if (status === "POSTED") return { label: "Sudah diposting", tone: "positive" };
  if (status === "PENDING_APPROVAL") return { label: "Menunggu persetujuan", tone: "pending" };
  if (status === "REJECTED") return { label: "Ditolak", tone: "critical" };
  if (status === "REVERSED") return { label: "Sudah dibalik", tone: "neutral" };
  return { label: formatBusinessLabel(status), tone: "neutral" };
}
export function parseImportRows(source: string): {
  readonly rows: readonly {
    readonly rowNumber: number;
    readonly materialName: string;
    readonly materialCode: string;
    readonly locationName: string;
    readonly quantity: number;
    readonly unitCost: number;
  }[];
} {
  const table = parseCsvTable(source);
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
