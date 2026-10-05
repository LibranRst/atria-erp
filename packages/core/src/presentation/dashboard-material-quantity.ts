import type { FinanceDashboardMaterialIssue } from "../finance/dashboard-contracts";

export type DashboardMaterialQuantityInput = Pick<
  FinanceDashboardMaterialIssue,
  "type" | "availableStock" | "requiredStock" | "quantity" | "unit"
>;

const compactPrefix: Record<FinanceDashboardMaterialIssue["type"], string> = {
  RAP_SHORTAGE: "Kurang",
  LOW_STOCK: "Tersedia",
  WASTE: "Terbuang",
  ADJUSTMENT: "Penyesuaian",
  REVERSAL_REQUEST: "Pembatalan",
};

/** Historical movement DTOs do not carry a current physical-stock snapshot. */
export function hasDashboardMaterialStockContext(
  item: Pick<FinanceDashboardMaterialIssue, "type">,
): boolean {
  return item.type === "RAP_SHORTAGE" || item.type === "LOW_STOCK";
}

/** Available stock and movement quantities must never be presented as a shortage. */
export function formatDashboardMaterialQuantity(
  item: DashboardMaterialQuantityInput,
  compact: boolean = false,
): string | null {
  const quantity =
    item.type === "RAP_SHORTAGE"
      ? item.requiredStock === null
        ? null
        : Math.max(0, item.requiredStock - item.availableStock)
      : item.type === "LOW_STOCK"
        ? item.availableStock
        : item.quantity;
  if (quantity === null) return null;
  const value = `${quantity.toLocaleString("id-ID")} ${item.unit}`;
  return compact ? `${compactPrefix[item.type]} ${value}` : value;
}
