import { mock } from "bun:test";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bun resolves hoisted UI peers independently of the Next.js app bundler.
 * Mobile's React and Bun's isolated copies must share the web renderer's real
 * React instance in web tests, or their hooks read a different dispatcher.
 * This aliases the actual implementation only in the test preload; production
 * and native module resolution remain unchanged.
 */
const webRequire = createRequire(import.meta.url);
const canonicalReact = await import("react");
const canonicalReactPath = realpathSync(webRequire.resolve("react"));
const workspaceModules = fileURLToPath(new URL("../../../node_modules/", import.meta.url));
const isolatedModules = path.join(workspaceModules, ".bun");
const reactDirectories = [path.join(workspaceModules, "react")];
if (existsSync(isolatedModules)) {
  for (const entry of readdirSync(isolatedModules)) {
    if (entry.startsWith("react@")) {
      reactDirectories.push(path.join(isolatedModules, entry, "node_modules", "react"));
    }
  }
}
for (const directory of reactDirectories) {
  const entry = path.join(directory, "index.js");
  if (existsSync(entry) && realpathSync(entry) !== canonicalReactPath) {
    mock.module(entry, () => canonicalReact);
  }
}

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
 *
 * `ATRIA_TEST_EMPTY_DATABASE_URL` melayani kebutuhan yang berlawanan: suite
 * yang menguji keadaan nol baris. Keduanya tidak pernah dipakai bersamaan —
 * satu menuntut seed demo, satunya menuntut database kosong — jadi yang
 * disetel-lah yang dipakai, dan seed demo menang bila keduanya ada.
 */
const testDatabaseUrl =
  process.env.ATRIA_TEST_DATABASE_URL ?? process.env.ATRIA_TEST_EMPTY_DATABASE_URL;

process.env.DATABASE_URL = testDatabaseUrl
  ? testDatabaseUrl
  : "postgresql://atria-test-guard:disabled@127.0.0.1:1/atria_test_database_not_configured";
