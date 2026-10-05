/**
 * Menghitung jumlah baris di seluruh skema `public` — sungguhan, bukan taksiran.
 *
 * Jangan pernah memakai `pg_stat_user_tables.n_live_tup` untuk ini. Kolom itu
 * diisi oleh ANALYZE/autovacuum, dan pada database yang baru dibuat lewat
 * branch Neon statistiknya belum ada sama sekali: ia melaporkan 0 untuk
 * database yang isinya ratusan baris. Persis kondisi itulah yang paling sering
 * dihadapi kedua pemakainya — instance pelanggan baru dan branch pengujian.
 *
 * Dua pemakainya bergantung pada angka ini untuk hal yang berbeda, dan
 * dua-duanya gagal ke arah yang salah bila angkanya nol palsu:
 *
 * - `provision-instance.ts` menolak database yang sudah berisi. Nol palsu
 *   membuatnya menganggap instance pelanggan yang sedang jalan sebagai
 *   database kosong.
 * - `perf-loaders.ts` menolak menyebut hasilnya patokan di bawah 500 baris.
 *   Nol palsu membuatnya membuang pengukuran yang justru sah.
 *
 * `query_to_xml` dipakai supaya `count(*)` per tabel bisa dijalankan dalam satu
 * query, tanpa perlu bolak-balik. Lebih lambat dari membaca statistik, dan itu
 * memang harga yang dibayar untuk jawaban yang benar.
 */
import type { Pool } from "@neondatabase/serverless";

const CENSUS_SQL = `
  SELECT COALESCE(sum(cnt), 0)::text AS n FROM (
    SELECT (xpath('/row/c/text()',
      query_to_xml(format('SELECT count(*) AS c FROM %I.%I', schemaname, tablename),
                   false, true, '')))[1]::text::bigint AS cnt
    FROM pg_tables WHERE schemaname = 'public'
  ) t
`;

export async function countAllRows(pool: Pool): Promise<number> {
  const result = await pool.query<{ n: string }>(CENSUS_SQL);
  return Number(result.rows[0]?.n ?? 0);
}
