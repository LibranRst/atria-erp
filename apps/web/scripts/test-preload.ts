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
