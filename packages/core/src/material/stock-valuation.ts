export function calculateTransferDestinationAverage(input: {
  readonly destinationQuantity: number;
  readonly destinationAverageCost: number;
  readonly transferQuantity: number;
  readonly sourceAverageCost: number;
}): number {
  const nextQuantity = input.destinationQuantity + input.transferQuantity;
  if (nextQuantity <= 0) return input.sourceAverageCost;
  return (
    (input.destinationQuantity * input.destinationAverageCost +
      input.transferQuantity * input.sourceAverageCost) /
    nextQuantity
  );
}

export function calculateReceiptReversalValuation(input: {
  readonly currentQuantity: number;
  readonly currentAverageCost: number;
  readonly receiptQuantity: number;
  readonly receiptUnitCost: number;
}): { readonly nextQuantity: number; readonly nextAverageCost: number } {
  const nextQuantity = input.currentQuantity - input.receiptQuantity;
  const nextValue =
    input.currentQuantity * input.currentAverageCost -
    input.receiptQuantity * input.receiptUnitCost;
  if (nextQuantity < 0) throw new Error("INSUFFICIENT_RECEIPT_QUANTITY");
  if (nextValue < -0.01) throw new Error("INSUFFICIENT_RECEIPT_VALUE");
  return {
    nextQuantity,
    nextAverageCost: nextQuantity > 0 ? Math.max(0, nextValue / nextQuantity) : 0,
  };
}
