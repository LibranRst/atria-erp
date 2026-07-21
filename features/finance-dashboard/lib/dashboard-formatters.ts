export const fullMoney = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function shortMoney(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000) {
    return `${sign}Rp ${(absolute / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 2,
    })} M`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}Rp ${(absolute / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }
  return `${sign}Rp ${absolute.toLocaleString("id-ID")}`;
}

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
