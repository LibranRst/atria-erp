import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { createClientId } from "@/lib/utils/client-id";

export type MaterialTab = "overview" | "inventory" | "needs" | "activity";
export type ProjectOperation = "RESERVE" | "USE" | "RETURN" | "WASTE";
export type WarehouseAction =
  | ProjectOperation
  | "LOCATION"
  | "TRANSFER"
  | "COUNT"
  | "ADJUST";

export type SimpleItem = {
  readonly key: string;
  readonly materialId: string;
  readonly quantity: string;
};

export const materialTabs: readonly {
  readonly id: MaterialTab;
  readonly label: string;
}[] = [
  { id: "overview", label: "Ringkasan" },
  { id: "inventory", label: "Inventori" },
  { id: "needs", label: "Kebutuhan" },
  { id: "activity", label: "Aktivitas" },
];

export const materialRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function toMaterialTab(value: string | null): MaterialTab {
  return materialTabs.some((item) => item.id === value)
    ? (value as MaterialTab)
    : "overview";
}

export function shortMaterialMoney(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace("jt", " jt")
    .replace("M", " M");
}

export function formatMaterialQuantity(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export type StockImpact = {
  readonly before: number;
  readonly delta: number;
  readonly after: number;
  readonly reserved: number;
  readonly safe: boolean;
};

export function calculateStockImpact({
  before,
  delta,
  reserved = 0,
}: {
  readonly before: number;
  readonly delta: number;
  readonly reserved?: number;
}): StockImpact {
  const after = before + delta;
  return { before, delta, after, reserved, safe: after >= reserved };
}

export function summarizeStockCountVariance(
  rows: readonly {
    readonly systemQuantity: number;
    readonly countedQuantity: number;
    readonly unitCost: number;
  }[],
): { readonly changedCount: number; readonly totalQuantity: number; readonly totalValue: number } {
  return rows.reduce(
    (summary, row) => {
      const variance = row.countedQuantity - row.systemQuantity;
      return {
        changedCount: summary.changedCount + (variance === 0 ? 0 : 1),
        totalQuantity: summary.totalQuantity + variance,
        totalValue: summary.totalValue + variance * row.unitCost,
      };
    },
    { changedCount: 0, totalQuantity: 0, totalValue: 0 },
  );
}

export function formatMaterialDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMovementType(value: string): string {
  return formatBusinessLabel(value, "INVENTORY");
}

export function formatMaterialStatus(value: string): string {
  const labels: Record<string, string> = {
    AVAILABLE: "Tersedia",
    LOW_STOCK: "Menipis",
    OUT_OF_STOCK: "Habis",
    RESERVED: "Terikat",
    DRAFT: "Draft",
    PENDING_APPROVAL: "Menunggu",
    POSTED: "Selesai",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    REVERSAL_REQUESTED: "Pembatalan diminta",
  };
  return labels[value] ?? formatBusinessLabel(value);
}

export function createSimpleItem(): SimpleItem {
  return { key: createClientId("material-item"), materialId: "", quantity: "1" };
}

export function materialBadgeTone(
  status: string,
): "HEALTHY" | "WARNING" | "CRITICAL" | "DRAFT" | "APPROVED" {
  if (["AVAILABLE", "POSTED"].includes(status)) return "HEALTHY";
  if (
    [
      "LOW_STOCK",
      "RESERVED",
      "PENDING_APPROVAL",
      "REVERSAL_REQUESTED",
    ].includes(status)
  ) {
    return "WARNING";
  }
  if (status === "OUT_OF_STOCK") return "CRITICAL";
  if (status === "DRAFT") return "DRAFT";
  return "APPROVED";
}

export type GroupedMaterial = {
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly rows: MaterialOperationsDashboard["inventory"];
  readonly shortages: MaterialOperationsDashboard["shortages"];
};

export type GroupedMaterialStockSummary = {
  readonly currentStock: number;
  readonly reservedStock: number;
  readonly availableStock: number;
  readonly minimumStock: number;
  readonly stockValue: number;
  readonly locationCount: number;
  readonly shortageCount: number;
  readonly status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | "RESERVED";
};

export function getGroupedMaterialStockSummary(
  material: GroupedMaterial,
): GroupedMaterialStockSummary {
  const currentStock = material.rows.reduce((sum, row) => sum + row.currentStock, 0);
  const reservedStock = material.rows.reduce((sum, row) => sum + row.reservedStock, 0);
  const availableStock = material.rows.reduce((sum, row) => sum + row.availableStock, 0);
  const minimumStock = material.rows.reduce((sum, row) => sum + row.minimumStock, 0);
  const stockValue = material.rows.reduce(
    (sum, row) => sum + row.currentStock * row.averageCost,
    0,
  );
  const status = material.rows.some((row) => row.status === "OUT_OF_STOCK")
    ? "OUT_OF_STOCK"
    : material.rows.some((row) => row.status === "LOW_STOCK")
      ? "LOW_STOCK"
      : material.rows.some((row) => row.status === "RESERVED")
        ? "RESERVED"
        : "AVAILABLE";

  return {
    currentStock,
    reservedStock,
    availableStock,
    minimumStock,
    stockValue,
    locationCount: material.rows.length,
    shortageCount: material.shortages.filter((row) => row.needToBuy > 0).length,
    status,
  };
}
