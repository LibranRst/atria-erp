/**
 * Format tanggal untuk antarmuka, memakai locale `id-ID`. Simpan di sini agar
 * baris dashboard, persetujuan, dan daftar lain memformat tanggal dengan cara
 * yang sama alih-alih memanggil `toLocaleDateString` dengan opsi masing-masing.
 */

/** Contoh: `28 Jul`. Untuk baris padat yang tahunnya sudah jelas dari konteks. */
export function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
