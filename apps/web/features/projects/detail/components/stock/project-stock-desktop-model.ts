import { projectStockPermission } from "@atria/core/ai/project-stock";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { StockMovement } from "../../types/project-tabs-types";
import type { ProjectStockItem } from "./project-stock-types";

export function formatStockQuantity(value: string | number): string {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 6 });
}

export function projectMovementLabel(type: string): string {
  const labels: Readonly<Record<string, string>> = {
    RESERVE: "Reservasi",
    RELEASE_RESERVATION: "Lepas reservasi",
    USE: "Pemakaian",
    STOCK_OUT: "Stok keluar",
    STOCK_IN: "Stok masuk",
    GOODS_RECEIPT: "Penerimaan barang",
    RETURN: "Pengembalian",
    WASTE: "Material terbuang",
    ADJUSTMENT: "Penyesuaian",
    TRANSFER: "Transfer",
  };
  return labels[type] ?? formatBusinessLabel(type);
}

/** Counts records; unlike source units must never become one quantity. */
export function projectStockCounts(items: readonly ProjectStockItem[]): {
  readonly materials: number;
  readonly shortage: number;
  readonly reserved: number;
  readonly used: number;
  readonly leftover: number;
} {
  return {
    materials: items.length,
    shortage: items.filter((row) => row.needToBuy > 0).length,
    reserved: items.filter((row) => row.reservedQuantity > 0).length,
    used: items.filter((row) => row.usedQuantity > 0).length,
    leftover: items.filter((row) => row.leftoverQuantity > 0).length,
  };
}

export function filterProjectStockItems(
  items: readonly ProjectStockItem[],
  search: string,
  condition: string,
): readonly ProjectStockItem[] {
  const needle = search.trim().toLocaleLowerCase("id-ID");
  return items.filter((row) => {
    if (condition === "need" && row.needToBuy <= 0) return false;
    if (condition === "covered" && row.needToBuy > 0) return false;
    if (condition === "reserved" && row.reservedQuantity <= 0) return false;
    if (condition === "used" && row.usedQuantity <= 0) return false;
    return (
      !needle ||
      `${row.name} ${row.materialName} ${row.area}`.toLocaleLowerCase("id-ID").includes(needle)
    );
  });
}

export function filterProjectStockMovements(
  rows: readonly StockMovement[],
  search: string,
  type: string,
  location: string,
): readonly StockMovement[] {
  const needle = search.trim().toLocaleLowerCase("id-ID");
  return rows.filter(
    (row) =>
      (type === "all" || row.movementType === type) &&
      (location === "all" || row.location.name === location) &&
      (!needle ||
        `${row.material.name} ${row.createdBy.name} ${row.location.name} ${row.note ?? ""} ${projectMovementLabel(row.movementType)}`
          .toLocaleLowerCase("id-ID")
          .includes(needle)),
  );
}

export type ProjectStockManualOperation = "RESERVE" | "USE" | "RETURN" | "WASTE";
export function allowedProjectStockOperations(
  can: (permission: PermissionKey) => boolean,
): readonly ProjectStockManualOperation[] {
  const operations: readonly ProjectStockManualOperation[] = ["RESERVE", "USE", "RETURN", "WASTE"];
  return operations.filter((operation) => can(projectStockPermission(operation)));
}
