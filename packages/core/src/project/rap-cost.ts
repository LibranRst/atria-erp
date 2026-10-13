import { fromCents, parseNumericToCents } from "../finance/money-minor";

export const RAP_QUANTITY_MAX = 9_999_999_999.99;
export const RAP_COST_MAX = 9_999_999_999_999.99;
export function hasTwoDecimalPrecision(value: number): boolean {
  return Number.isFinite(value) && Number(value.toFixed(2)) === value;
}
export function calculateRapMaterialCost(input: {
  readonly requiredQuantity: number;
  readonly bufferQuantity: number;
  readonly estimatedUnitCost: number;
}): {
  readonly requiredQuantity: string;
  readonly bufferQuantity: string;
  readonly totalQuantity: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
} {
  if (
    !hasTwoDecimalPrecision(input.requiredQuantity) ||
    input.requiredQuantity <= 0 ||
    input.requiredQuantity > RAP_QUANTITY_MAX ||
    !hasTwoDecimalPrecision(input.bufferQuantity) ||
    input.bufferQuantity < 0 ||
    input.bufferQuantity > RAP_QUANTITY_MAX ||
    !hasTwoDecimalPrecision(input.estimatedUnitCost) ||
    input.estimatedUnitCost < 0 ||
    input.estimatedUnitCost > RAP_COST_MAX
  )
    throw new Error("Kuantitas dan harga RAP harus valid dengan maksimal dua angka desimal.");
  const required = input.requiredQuantity.toFixed(2),
    buffer = input.bufferQuantity.toFixed(2),
    unitCost = input.estimatedUnitCost.toFixed(2);
  const total = parseNumericToCents(required) + parseNumericToCents(buffer);
  const cost = (total * parseNumericToCents(unitCost) + 50n) / 100n;
  if (total > 999_999_999_999n || cost > 999_999_999_999_999n)
    throw new Error("Total kuantitas atau estimasi RAP melampaui batas nilai.");
  return {
    requiredQuantity: required,
    bufferQuantity: buffer,
    totalQuantity: fromCents(total),
    estimatedUnitCost: unitCost,
    estimatedTotalCost: fromCents(cost),
  };
}
export function sumRapAmounts(values: readonly string[]): number {
  const total = values.reduce((sum, value) => sum + parseNumericToCents(value), 0n);
  if (total > 999_999_999_999_999n || total < -999_999_999_999_999n)
    throw new Error("Total nilai RAP melampaui batas.");
  return Number(fromCents(total));
}
export function availableRapStock(
  inventory: readonly { readonly currentStock: string; readonly reservedStock: string }[],
): number {
  return Number(
    fromCents(
      inventory.reduce(
        (sum, row) =>
          sum + parseNumericToCents(row.currentStock) - parseNumericToCents(row.reservedStock),
        0n,
      ),
    ),
  );
}
