export function cashTransactionNeedsAction(item: {
  readonly exceptionReason: string | null;
}): boolean {
  return item.exceptionReason === null;
}

export function statementRowNeedsAction(item: {
  readonly suggestedCashTransactionId: string | null;
  readonly candidateCount: number;
}): boolean {
  return item.suggestedCashTransactionId !== null || item.candidateCount > 1;
}
