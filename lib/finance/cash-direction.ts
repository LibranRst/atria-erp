export const CASH_DIRECTIONS = ["INFLOW", "OUTFLOW"] as const;

export type CashDirection = (typeof CASH_DIRECTIONS)[number];

export function normalizeCashDirection(value: string): CashDirection {
  if (value === "INFLOW" || value === "DEBIT") return "INFLOW";
  if (value === "OUTFLOW" || value === "CREDIT") return "OUTFLOW";
  throw new Error(`INVALID_CASH_DIRECTION: ${value}`);
}

export function isCashInflow(value: string): boolean {
  return normalizeCashDirection(value) === "INFLOW";
}
