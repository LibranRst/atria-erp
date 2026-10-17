import type {
  ProjectCategoryPlanItemView,
  RapItemView,
  RapOverviewFilter,
} from "../../types/rap-rab-types";

export interface RapDesktopRow {
  readonly id: string;
  readonly kind: RapOverviewFilter;
  readonly name: string;
  readonly area: string;
  readonly quantity: string;
  readonly unit: string;
  readonly estimate: number;
  readonly actual: number;
  readonly status: string;
  readonly material: RapItemView | null;
  readonly package: ProjectCategoryPlanItemView | null;
}

export function formatRapQuantity(value: string | number): string {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 4 });
}

export function rapSourceLabel(source: string): string {
  if (source === "STOCK") return "Stok gudang";
  if (source === "PURCHASE") return "Pembelian";
  if (source === "STOCK_AND_PURCHASE") return "Stok & pembelian";
  if (source === "VENDOR") return "Vendor";
  return "Belum ditentukan";
}

export function materialDesktopRows(items: readonly RapItemView[]): readonly RapDesktopRow[] {
  return items.map((item) => ({
    id: item.id,
    kind: "MATERIAL",
    name: item.name,
    area: item.area,
    quantity: item.totalQuantity,
    unit: item.unit,
    estimate: Number(item.estimatedTotalCost),
    actual: item.actualMaterialCost,
    status: item.status,
    material: item,
    package: null,
  }));
}

export function packageDesktopRows(
  items: readonly ProjectCategoryPlanItemView[],
  kind: "TUKANG" | "SUBCON",
): readonly RapDesktopRow[] {
  return items.map((item) => ({
    id: item.id,
    kind,
    name: item.name,
    area: item.area,
    quantity: item.quantity,
    unit: item.unit,
    estimate: Number(item.estimatedTotalCost),
    actual: item.actualCost,
    status: item.status,
    material: null,
    package: item,
  }));
}

export function filterRapDesktopRows(
  rows: readonly RapDesktopRow[],
  search: string,
  condition: string,
): readonly RapDesktopRow[] {
  const query = search.trim().toLocaleLowerCase("id-ID");
  return rows.filter((row) => {
    const matchesSearch =
      `${row.name} ${row.area} ${row.package?.vendorName ?? ""} ${row.material?.materialName ?? ""}`
        .toLocaleLowerCase("id-ID")
        .includes(query);
    const matchesCondition =
      condition === "all" ||
      (condition === "need" && Boolean(row.material && row.material.needToBuy > 0)) ||
      (condition === "covered" && Boolean(row.material && row.material.needToBuy <= 0)) ||
      (condition === "draft" && row.status === "DRAFT") ||
      (condition === "ready" && row.status === "ACTIVE");
    return matchesSearch && matchesCondition;
  });
}

/** Counts records needing procurement; quantities with unlike units are never added. */
export function countMaterialsNeedingPurchase(items: readonly RapItemView[]): number {
  return items.filter((item) => item.needToBuy > 0).length;
}
