import { formatIdr } from "@atria/core/utils/money";

/**
 * Pembantu bersama untuk seluruh registry tool AI.
 *
 * Nilai uang selalu dikembalikan dalam dua bentuk: angka rupiah bulat untuk
 * perbandingan, dan string terformat untuk dikutip langsung oleh model.
 * Model dilarang menghitung aritmatika uang sendiri.
 */

/**
 * Label cakupan yang ikut dikembalikan tool dan ditampilkan di kepala kartu.
 *
 * Sebuah kartu yang sudah dipersempit harus terbaca sebagai dipersempit. Tanpa
 * penanda ini, daftar berisi satu proyek tampak seperti klaim bahwa memang hanya
 * ada satu proyek — dan itu jauh lebih menyesatkan daripada daftar yang panjang.
 */
export function describeFilters(labels: readonly (string | null | undefined)[]): string[] {
  return labels.filter((label): label is string => typeof label === "string" && label.length > 0);
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "aktif",
  DRAFT: "draft",
  ON_HOLD: "ditahan",
  COMPLETED: "selesai",
  CANCELLED: "dibatalkan",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.toLowerCase();
}

export function toNumber(value: string | null): number {
  if (value === null) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: string | null): { amount: number; formatted: string } {
  const amount = Math.round(toNumber(value));
  return { amount, formatted: formatIdr(amount) };
}

/**
 * Selisih hari kalender menuju sebuah tanggal, dibulatkan ke tengah malam
 * supaya "jatuh tempo hari ini" tidak bergantung pada jam saat pertanyaan diajukan.
 */
export function daysUntil(target: Date, now: Date = new Date()): number {
  const startOfTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const startOfNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startOfTarget - startOfNow) / 86_400_000);
}
