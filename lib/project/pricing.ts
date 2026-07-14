export const DEFAULT_TEMPLATE_GROSS_MARGIN: Readonly<Record<string, number>> = {
  MATERIAL_ITEM: 0.3,
  WORK_PACKAGE: 0.2,
  SUBCON_PACKAGE: 0.2,
  CLIENT_LINE: 0.4,
};

export function calculateSuggestedClientPrice(internalCost: number, grossMarginRatio: number): number {
  if (!Number.isFinite(internalCost) || internalCost < 0) {
    throw new Error("Internal cost harus berupa angka non-negatif.");
  }
  if (!Number.isFinite(grossMarginRatio) || grossMarginRatio < 0 || grossMarginRatio >= 1) {
    throw new Error("Gross margin harus berada di antara 0% dan kurang dari 100%.");
  }
  return internalCost === 0 ? 0 : internalCost / (1 - grossMarginRatio);
}

export function calculateGrossMarginRatio(clientPrice: number, internalCost: number): number {
  if (clientPrice <= 0) return 0;
  return (clientPrice - internalCost) / clientPrice;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
