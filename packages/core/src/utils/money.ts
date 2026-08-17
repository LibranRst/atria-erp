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

/**
 * Versi paling ringkas untuk sel metrik sempit, misalnya grid 2-3 kolom di dalam
 * `SummaryFact` pada layar 320px. Pembulatan lebih agresif daripada
 * `formatShortIdr` sehingga hasilnya jarang melewati sekitar 9 karakter dan tidak
 * perlu dipotong. Gunakan `formatShortIdr` untuk nilai yang punya ruang normal.
 */
export function formatTightIdr(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  // Ambang batas memakai nilai yang sudah dibulatkan supaya tidak pernah muncul
  // hasil seperti "Rp 1.000 jt" yang justru lebih panjang daripada "Rp 1 M".
  if (absolute >= 999_500_000) {
    return `${sign}Rp ${(absolute / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }
  if (absolute >= 999_500) {
    return `${sign}Rp ${Math.round(absolute / 1_000_000).toLocaleString("id-ID")} jt`;
  }
  if (absolute >= 1_000) {
    return `${sign}Rp ${Math.round(absolute / 1_000).toLocaleString("id-ID")} rb`;
  }
  return `${sign}Rp ${absolute.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}
