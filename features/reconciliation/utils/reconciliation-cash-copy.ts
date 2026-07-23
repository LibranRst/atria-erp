import type { ReconciliationCashTransaction } from "@/app/actions/finance/reconciliation-workspace";

export function cashStatusCopy(item: ReconciliationCashTransaction): string {
  if (item.exceptionReason) {
    return `Pengecualian tercatat${item.exceptionByName ? ` · ${item.exceptionByName}` : ""}`;
  }
  if (item.ageDays === 0) return "Dicatat hari ini";
  if (item.ageDays <= 3) return `Belum cocok · ${item.ageDays} hari`;
  return `Perlu diperiksa · ${item.ageDays} hari`;
}

export function cashDisplayTitle(item: ReconciliationCashTransaction): string {
  return item.source?.description ?? item.description;
}

export function cashSourceCopy(item: ReconciliationCashTransaction, formattedDate: string): string {
  return item.source
    ? `${item.source.label} · ${item.source.projectName}`
    : `${item.bankAccountName} · ${formattedDate}`;
}

export function cashRowMetaCopy(item: ReconciliationCashTransaction): string {
  const direction = item.type === "INFLOW" ? "Dana masuk" : "Dana keluar";
  if (item.exceptionReason) return `${direction} · Pengecualian`;
  if (item.ageDays === 0) return `${direction} · Hari ini`;
  return `${direction} · ${item.ageDays} hari`;
}
