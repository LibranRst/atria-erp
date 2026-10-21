/**
 * Ambang persetujuan Owner sebagai konfigurasi, bukan konstanta yang tercecer.
 *
 * Sebelum berkas ini ada, angka Rp5.000.000 hidup di enam tempat dengan dua
 * satuan berbeda — dua konstanta, empat literal, dan salah satunya di dalam
 * komponen UI yang menghitung ulang keputusan milik server. Di sini ia menjadi
 * satu bentuk: **sen**, sesuai aturan uang aplikasi.
 *
 * Modul ini murni. Pembacaan `app_config` dan cache per-request tinggal di
 * `apps/web/lib/finance/approval-thresholds.ts`.
 */

/**
 * Dua kunci, bukan satu. Nominalnya kebetulan sama hari ini; alasan bisnis
 * pengeluaran lapangan dan pembayaran vendor tidak sama, dan menyatukan
 * keduanya akan membuat penyesuaian salah satunya menggeser yang lain.
 */
export const APPROVAL_THRESHOLD_CONFIG_KEYS = {
  fieldCost: "approval.field_cost.owner_threshold",
  vendorPayment: "approval.vendor_payment.owner_threshold",
} as const;

/** Rp5.000.000 dalam sen — nilai seed, dipakai ketika konfigurasi belum ada. */
export const DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS = BigInt(500_000_000);

export type ApprovalThresholds = {
  readonly fieldCostCents: bigint;
  readonly vendorPaymentCents: bigint;
};

export const DEFAULT_APPROVAL_THRESHOLDS: ApprovalThresholds = {
  fieldCostCents: DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS,
  vendorPaymentCents: DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS,
};

/**
 * Membaca nilai konfigurasi menjadi sen.
 *
 * Nilai yang rusak — bukan angka, negatif, atau pecahan — dikembalikan sebagai
 * `null` alih-alih nol. Nol adalah ambang yang sah dan berarti "semua butuh
 * persetujuan Owner"; menjadikannya nilai kegagalan akan mengubah baris
 * konfigurasi yang salah ketik menjadi penguncian seluruh pencairan.
 */
export function parseThresholdCents(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  return BigInt(trimmed);
}

/** Sen → rupiah dengan presisi sen, termasuk aturan pengeluaran lapangan. */
export function thresholdCentsToRupiah(cents: bigint): number {
  return Number(cents) / 100;
}
