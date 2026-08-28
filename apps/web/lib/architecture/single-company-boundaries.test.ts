import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Menjaga instance agar bisa dijual ke perusahaan lain.
 *
 * Satu instance melayani satu perusahaan, dan namanya datang dari `tenant.name`.
 * Menuliskan "Dekoria" di kode runtime membuat instance pelanggan menyebut nama
 * perusahaan lain di layar mereka sendiri — kegagalan yang tidak menghentikan
 * apa pun, tidak melempar apa pun, dan langsung terbaca sebagai kecerobohan oleh
 * orang yang baru saja membayar.
 *
 * Dokumen, komentar, seed, dan test dikecualikan: di sana "Dekoria" memang
 * merujuk perusahaan yang nyata.
 */

const WEB_ROOT = join(import.meta.dir, "..", "..");

/** Direktori yang isinya benar-benar dikirim ke layar pengguna. */
const RUNTIME_DIRS = ["app", "features", "lib", "server", "components"] as const;

/**
 * Pengecualian yang disengaja. Menambah baris ke sini adalah keputusan: setiap
 * entri berarti satu tempat yang tidak ikut berganti nama untuk pelanggan.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    "lib/company/identity.ts",
    "Membaca nama perusahaan; menyebut Dekoria hanya di komentar penjelas.",
  ],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Buang komentar supaya penjelasan tidak dihitung sebagai kebocoran. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("batas satu perusahaan per instance", () => {
  test("tidak ada nama perusahaan yang ditulis mati di kode runtime", () => {
    const offenders: string[] = [];

    for (const dir of RUNTIME_DIRS) {
      for (const file of walk(join(WEB_ROOT, dir))) {
        const relative = file.slice(WEB_ROOT.length + 1);
        if (ALLOWED.has(relative)) continue;
        if (!/Dekoria/i.test(stripComments(readFileSync(file, "utf8")))) continue;
        offenders.push(relative);
      }
    }

    expect(offenders).toEqual([]);
  });

  test("setiap pengecualian menyebutkan alasannya", () => {
    const withoutReason = [...ALLOWED.entries()]
      .filter(([, reason]) => reason.trim().length < 20)
      .map(([file]) => file);

    expect(withoutReason).toEqual([]);
  });

  test("prompt AI menerima nama perusahaan, bukan menetapkannya", () => {
    const prompts = readFileSync(join(WEB_ROOT, "lib", "ai", "prompts.ts"), "utf8");

    // Nama perusahaan harus masuk sebagai parameter yang disisipkan ke teks.
    expect(prompts).toContain("sharedPrompt(companyName)");
    expect(prompts).toContain("${companyName}");
  });
});
