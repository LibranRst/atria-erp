import { describe } from "bun:test";

/**
 * Gerbang untuk suite yang benar-benar membuka koneksi Postgres.
 *
 * Sebagian test finance/project memanggil Server Action asli di atas fixture
 * seed (BCA_ACC_ID, project MENTENG/SUDIRMAN). Tanpa gerbang ini setiap
 * `bun run test` menulis ke database `DATABASE_URL` yang sama dengan yang
 * dipakai dev server, lalu meninggalkan drift yang tidak dibersihkan
 * `afterAll` — saldo rekening, `material_inventory`, dan `audit_log` tetap
 * bergerak walau baris anaknya sudah dihapus.
 *
 * Karena itu suite semacam itu hanya berjalan ketika environment menyediakan
 * database khusus test lewat `ATRIA_TEST_DATABASE_URL`. Tanpa variabel itu,
 * `scripts/test-preload.ts` menunjuk `DATABASE_URL` ke alamat buntu sehingga
 * koneksi yang tidak sengaja gagal cepat, bukan mengotori data development.
 */
export const INTEGRATION_DATABASE_ENV = "ATRIA_TEST_DATABASE_URL";

export const hasIntegrationDatabase = Boolean(process.env[INTEGRATION_DATABASE_ENV]);

export const describeIntegration = hasIntegrationDatabase ? describe : describe.skip;
