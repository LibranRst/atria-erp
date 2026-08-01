/**
 * Format uang memakai satu sumber kebenaran di `lib/utils/money.ts`. Alias ini
 * dipertahankan agar call site Dashboard tidak perlu diubah massal.
 */
export { idrMoney as fullMoney, formatShortIdr as shortMoney } from "@/lib/utils/money";

export function badgeStatus(value: string): "CRITICAL" | "WARNING" | "APPROVED" {
  if (value === "CRITICAL" || value === "OVER_BUDGET") return "CRITICAL";
  if (value === "WARNING" || value === "WATCH") return "WARNING";
  return "APPROVED";
}

export function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
