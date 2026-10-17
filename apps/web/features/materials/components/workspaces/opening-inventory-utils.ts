import { parseOpeningInventoryCsv } from "@atria/core/import/material-csv";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
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
  return parseOpeningInventoryCsv(source);
}
