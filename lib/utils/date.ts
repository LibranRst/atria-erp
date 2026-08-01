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

/**
 * Tanggal lokal dalam bentuk `YYYY-MM-DD`, memakai zona waktu perangkat —
 * bukan UTC. Ini disengaja: nilainya mewakili tanggal kalender yang dilihat
 * pengguna (tanggal transaksi, jatuh tempo), sehingga `toISOString()` akan
 * salah menggesernya satu hari bagi pengguna di timur UTC.
 */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
