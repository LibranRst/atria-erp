export const idrMoney = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIdr(value: number): string {
  return `Rp ${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export function formatShortIdr(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
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
  return `${sign}Rp ${absolute.toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  })}`;
}
