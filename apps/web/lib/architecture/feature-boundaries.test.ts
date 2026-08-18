import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Di-anchor ke lokasi file ini, bukan `process.cwd()`, supaya hasilnya sama
// dari mana pun suite dijalankan.
const APP_ROOT = path.resolve(import.meta.dir, "..", "..");
const FEATURES_ROOT = path.join(APP_ROOT, "features");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * Ketergantungan antar-slice yang diizinkan, beserta alasannya. Rute di `app/**`
 * boleh mengimpor slice mana pun — itu memang tugasnya menyusun halaman; aturan
 * ini hanya mengatur slice yang menjangkau slice lain.
 *
 * Menambah baris di sini adalah keputusan desain, bukan formalitas. Sebelum
 * menambah, pertimbangkan dulu: kalau sesuatu dipakai tiga slice atau lebih,
 * biasanya tempatnya di `components/ui` atau `lib/`, bukan jadi edge baru.
 */
const ALLOWED_EDGES: Readonly<Record<string, readonly string[]>> = {
  // Onboarding memandu penyiapan domain lain, jadi memang menyusunnya.
  onboarding: ["settings", "finance-dashboard", "materials", "approvals", "administration"],
  // Halaman proyek menampilkan pengeluaran, stok, dan riwayat aktivitasnya.
  projects: ["expenses", "materials", "activity-detail"],
  // Dashboard menampilkan antrean persetujuan dan membuka detail aktivitas.
  "finance-dashboard": ["approvals", "activity-detail"],
  // Baris material dan pengeluaran membuka sheet detail aktivitas.
  materials: ["activity-detail"],
  expenses: ["activity-detail"],
  // Persetujuan menilai pengajuan stok, jadi memakai penyajian material.
  approvals: ["materials"],
  // Settings memuat master material dan menampung workspace administrasi.
  // Arahnya satu jalur: administration tidak lagi menunjuk balik ke settings
  // sejak primitif configuration-workspace naik ke `components/ui`.
  settings: ["materials", "administration"],
};

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function sliceOf(filePath: string): string {
  return path.relative(FEATURES_ROOT, filePath).split(path.sep)[0];
}

function actualEdges(): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const filePath of collectSourceFiles(FEATURES_ROOT)) {
    if (filePath.endsWith(".stories.tsx") || /\.test\.tsx?$/.test(filePath)) continue;
    const source = readFileSync(filePath, "utf8");
    const from = sliceOf(filePath);
    for (const match of source.matchAll(/@\/features\/([a-z0-9-]+)/g)) {
      const to = match[1];
      if (to === from) continue;
      if (!edges.has(from)) edges.set(from, new Set());
      edges.get(from)?.add(to);
    }
  }
  return edges;
}

describe("feature slice boundaries", () => {
  test("every cross-slice dependency is one the architecture declares", () => {
    const undeclared: string[] = [];
    for (const [from, targets] of actualEdges()) {
      for (const to of targets) {
        if (!ALLOWED_EDGES[from]?.includes(to)) undeclared.push(`${from} -> ${to}`);
      }
    }

    expect(undeclared.sort()).toEqual([]);
  });

  test("the declared list has no edge that no longer exists", () => {
    const edges = actualEdges();
    const stale = Object.entries(ALLOWED_EDGES).flatMap(([from, targets]) =>
      targets.filter((to) => !edges.get(from)?.has(to)).map((to) => `${from} -> ${to}`),
    );

    expect(stale.sort()).toEqual([]);
  });

  test("no slice keeps cross-cutting infrastructure that is not its own domain", () => {
    const sliceNames = readdirSync(FEATURES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // `shared-*` bukan domain. Hook dan helper lintas-domain tinggal di `lib/`.
    expect(sliceNames.filter((name) => name.startsWith("shared-"))).toEqual([]);
  });
});
