import { mock } from "bun:test";

/**
 * Preload untuk `bun test` (didaftarkan di bunfig.toml).
 *
 * `server-only` adalah penanda build Next.js, bukan modul yang benar-benar
 * dijalankan. Entry default-nya sengaja melempar error agar impor dari Client
 * Component gagal saat bundling. Di test runner tidak ada bundler yang
 * menetapkan kondisi "react-server", jadi modul itu dinetralkan di sini.
 */
mock.module("server-only", () => ({}));

/**
 * Isolasi database test.
 *
 * `db/index.ts` membaca `DATABASE_URL` saat modul dimuat, jadi penggantian
 * harus terjadi di preload — sebelum test file mana pun mengimpor `@/db`.
 *
 * Ketika `ATRIA_TEST_DATABASE_URL` tersedia, seluruh koneksi test diarahkan
 * ke sana. Ketika tidak, `DATABASE_URL` ditunjuk ke alamat buntu supaya
 * koneksi yang lolos dari `describeIntegration` gagal cepat dan terlihat,
 * bukan diam-diam menulis ke database development.
 */
const testDatabaseUrl = process.env.ATRIA_TEST_DATABASE_URL;

process.env.DATABASE_URL = testDatabaseUrl
  ? testDatabaseUrl
  : "postgresql://atria-test-guard:disabled@127.0.0.1:1/atria_test_database_not_configured";
