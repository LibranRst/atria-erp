import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Menjaga perancah tenant (Fase 0, docs/plans/2026-08-27-tenant-foundation.md).
 *
 * Isolasi antar-perusahaan hari ini masih bergantung pada satu hal: setiap tabel
 * yang memuat data perusahaan punya kolom `tenant_id`. Tanpa penjagaan ini,
 * tabel baru akan lahir tanpa kolom itu, dan ketiadaannya baru ketahuan pada
 * Fase 3 — saat sudah ada dua perusahaan di dalam database yang sama.
 *
 * Berkas ini sengaja membaca sumber, bukan metadata Drizzle, sehingga kegagalan
 * menunjuk langsung ke baris yang harus disunting.
 */

const SCHEMA_DIR = join(import.meta.dir, "..", "..", "db", "schema");

/**
 * Tabel yang sengaja tidak bertenant. Menambah baris ke sini adalah keputusan
 * desain — sama seperti allowlist rute API di `server-boundaries.test.ts` —
 * jadi setiap entri wajib menyebutkan alasannya.
 */
const GLOBAL_TABLES: ReadonlyMap<string, string> = new Map([
  ["user", "Identitas orang, bukan milik perusahaan. Keanggotaan lewat tenant_member."],
  ["session", "Internal Better Auth, menggantung pada user."],
  ["account", "Internal Better Auth, menggantung pada user."],
  ["verification", "Internal Better Auth, menggantung pada user."],
  [
    "role",
    "Ditangguhkan sampai pekerjaan role-permission ter-commit. Lihat plan §Pertanyaan terbuka.",
  ],
  ["rolePermission", "Ditangguhkan bersama role."],
  ["projectCostCategory", "Enum tetap: MATERIAL, SUBCONTRACTOR, OPERATIONAL, OTHER."],
  ["aiUserPreference", "Preferensi milik orang, bukan perusahaan."],
  [
    "userRoleGuideState",
    "Pengakuan panduan milik identitas user; operasinya dibatasi sesi pengguna sendiri, bukan data perusahaan.",
  ],
  ["tenant", "Akar hierarki tenant itu sendiri."],
  ["tenantMember", "Punya tenantId sebagai foreign key, bukan sebagai kolom scoping."],
]);

type TableSource = {
  readonly name: string;
  readonly file: string;
  readonly body: string;
};

function readTables(): TableSource[] {
  const tables: TableSource[] = [];

  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
    const source = readFileSync(join(SCHEMA_DIR, file), "utf8");
    const declarations = source.split(/^export const /m).slice(1);

    for (const declaration of declarations) {
      const match = declaration.match(/^([a-zA-Z0-9]+) = pgTable\(/);
      if (!match) continue;

      // Potong di deklarasi berikutnya supaya body tidak bocor ke tabel lain.
      const body = declaration.split(/\n\}\);|\n\);/)[0];
      tables.push({ name: match[1], file, body });
    }
  }

  return tables;
}

const TABLES = readTables();

describe("batas tenant", () => {
  test("schema terbaca dan jumlah tabelnya masuk akal", () => {
    expect(TABLES.length).toBeGreaterThan(50);
  });

  test("setiap tabel bertenant punya kolom tenant_id", () => {
    const missing = TABLES.filter(
      (t) => !GLOBAL_TABLES.has(t.name) && !t.body.includes('uuid("tenant_id")'),
    ).map((t) => `${t.file} → ${t.name}`);

    expect(missing).toEqual([]);
  });

  test("tabel bertenant memakai DEFAULT perancah selama masih satu tenant", () => {
    // Fase 3 mencabut DEFAULT ini dan menggantinya dengan scoping eksplisit.
    // Sampai saat itu, ketiadaannya membuat setiap INSERT wajib menyebut tenant
    // dan memecah 865 titik query sekaligus.
    const withoutDefault = TABLES.filter(
      (t) =>
        !GLOBAL_TABLES.has(t.name) &&
        t.body.includes('uuid("tenant_id")') &&
        !t.body.includes("DEKORIA_TENANT_ID"),
    ).map((t) => `${t.file} → ${t.name}`);

    expect(withoutDefault).toEqual([]);
  });

  test("tidak ada constraint unik satu kolom yang mengasumsikan satu perusahaan", () => {
    // Nomor dokumen, kode, nama, dan email adalah milik perusahaan — unik di
    // dalam satu tenant, bukan unik sedunia. Daftar ini menangkap pola
    // `.unique()` yang lahir kembali pada tabel bertenant.
    const offenders: string[] = [];

    for (const table of TABLES) {
      if (GLOBAL_TABLES.has(table.name)) continue;
      if (!table.body.includes('uuid("tenant_id")')) continue;

      for (const line of table.body.split("\n")) {
        if (line.includes(".unique()")) {
          offenders.push(`${table.file} → ${table.name}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test("setiap entri allowlist global menyebutkan alasannya", () => {
    const withoutReason = [...GLOBAL_TABLES.entries()]
      .filter(([, reason]) => reason.trim().length < 20)
      .map(([name]) => name);

    expect(withoutReason).toEqual([]);
  });

  test("allowlist global tidak memuat tabel yang sudah tidak ada", () => {
    const known = new Set(TABLES.map((t) => t.name));
    const stale = [...GLOBAL_TABLES.keys()].filter((name) => !known.has(name));

    expect(stale).toEqual([]);
  });
});
