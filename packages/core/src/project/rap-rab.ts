export function getRapItemAvailabilityStatus(input: {
  readonly totalQuantity: number;
  readonly availableStock: number;
  readonly source: string;
}): string {
  if (input.totalQuantity <= input.availableStock) return "READY";
  if (input.availableStock > 0 && input.source === "STOCK_AND_PURCHASE") return "WAITING_PURCHASE";
  return "SHORTAGE";
}

export function calculateRabSellingUnitPrice(input: {
  readonly costUnitPrice: number;
  readonly targetGrossPercentage: number;
}): number {
  const margin = Math.min(Math.max(input.targetGrossPercentage / 100, 0), 0.8);
  if (input.costUnitPrice <= 0) return 0;
  return input.costUnitPrice / (1 - margin);
}
