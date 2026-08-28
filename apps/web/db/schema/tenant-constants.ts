/**
 * Modul daun tanpa import apa pun.
 *
 * `DEKORIA_TENANT_ID` dipakai sebagai `DEFAULT` kolom `tenant_id` di 53 tabel.
 * Menaruhnya di berkas terpisah — bukan di `tenant.ts` yang mengimpor `auth.ts` —
 * mencegah galat "cannot access before initialization" saat drizzle-kit memuat
 * seluruh schema lewat CJS.
 *
 * Nilai ini ikut di-seed oleh `db/seed/` dan `db:reset`. Mengubahnya menuntut
 * migrasi yang memindahkan seluruh baris.
 */
export const DEKORIA_TENANT_ID = "00000000-0000-4000-8000-000000000001";
