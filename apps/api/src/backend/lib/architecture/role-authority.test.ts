import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..", "..", "..", "..");
const CORE_ROOT = path.join(REPO_ROOT, "packages/core/src");
const WEB_ROOT = path.join(REPO_ROOT, "apps/web");
const SCANNED_DIRECTORIES = ["app", "lib", "server", "features", "components"];

/**
 * Nama peran sebagai literal adalah otoritas tandingan.
 *
 * Selama izin dijawab oleh `ROLE_PERMISSIONS`, setiap `roleName === "OWNER"`
 * yang tersebar di kode adalah aturan kedua yang tidak ikut berubah ketika izin
 * sebuah peran diubah. Begitu Owner bisa menyunting izin, setiap titik semacam
 * ini menjadi janji yang dilanggar diam-diam oleh aplikasi.
 *
 * Rencana penyatuannya ada di
 * `docs/plans/2026-08-25-role-permission-unification.md`.
 */
const ROLE_LITERAL_PATTERNS: readonly RegExp[] = [
  /(===|!==)\s*"(OWNER|FINANCE_ADMIN|PROJECT_MANAGER|PURCHASING)"/,
  /"(OWNER|FINANCE_ADMIN|PROJECT_MANAGER|PURCHASING)"\s*(===|!==)/,
  /\[\s*"(OWNER|FINANCE_ADMIN|PROJECT_MANAGER|PURCHASING)"[^\]]*\]\s*\.includes/,
  /\.includes\(\s*"(OWNER|FINANCE_ADMIN|PROJECT_MANAGER|PURCHASING)"/,
];

/**
 * Pengecualian permanen — bukan utang.
 *
 * `developer-account-simulation.ts` menyebut nama peran karena ia memang
 * mengenumerasi **target peniruan** di lingkungan pengembangan, bukan memutuskan
 * akses pemanggilnya: label dan rute pendaratannya terikat pada union
 * `DeveloperSimulationRole`. Ia mati total di production
 * (`ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED`), dan peran yang ditiru tetap tunduk
 * pada izinnya sendiri setelah peniruan berlaku.
 *
 * Daftar ini tidak dimaksudkan bertambah. Sebuah fitur yang merasa
 * membutuhkannya hampir selalu kekurangan permission key, bukan pengecualian.
 */
const PERMANENT_ROLE_NAME_USES: readonly string[] = ["app/actions/developer-account-simulation.ts"];

/**
 * Utang migrasi. Daftar ini HANYA boleh menyusut, dan entri yang sudah bersih
 * juga menggagalkan test — daftar yang basi berhenti menjadi ukuran kemajuan.
 *
 * Fase 1 `docs/plans/2026-08-25-role-permission-unification.md` menutup daftar
 * ini sampai kosong.
 */
const MIGRATION_DEBT: readonly string[] = [];

function collectSourceFiles(directory: string, root: string = APP_ROOT): string[] {
  const absolute = path.join(root, directory);
  const collected: string[] = [];
  if (!existsSync(absolute)) return collected;

  for (const entry of readdirSync(absolute)) {
    const absoluteEntry = path.join(absolute, entry);
    const relativeEntry = path.join(directory, entry);

    if (statSync(absoluteEntry).isDirectory()) {
      collected.push(...collectSourceFiles(relativeEntry, root));
      continue;
    }

    if (!/\.tsx?$/.test(entry)) continue;
    if (entry.includes(".test.") || entry.includes(".stories.")) continue;
    collected.push(relativeEntry);
  }

  return collected;
}

/**
 * Komentar dibuang sebelum dipindai.
 *
 * Sebuah berkas yang sudah bersih sering menyimpan satu kalimat yang menyebut
 * bentuk lamanya — persis penjelasan yang paling berguna bagi pembaca
 * berikutnya. Menggagalkannya karena itu hanya mengajarkan orang menghapus
 * penjelasannya, bukan memperbaiki kodenya.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function usesRoleLiteral(relativePath: string, root: string = APP_ROOT): boolean {
  const source = stripComments(readFileSync(path.join(root, relativePath), "utf8"));
  return ROLE_LITERAL_PATTERNS.some((pattern) => pattern.test(source));
}

const sourceFiles = SCANNED_DIRECTORIES.flatMap((directory) => collectSourceFiles(directory));
const offenders = sourceFiles.filter((file) => usesRoleLiteral(file));
const webOffenders = SCANNED_DIRECTORIES.flatMap((directory) =>
  collectSourceFiles(directory, WEB_ROOT),
).filter((file) => usesRoleLiteral(file, WEB_ROOT));

/**
 * `packages/core` ikut dipindai.
 *
 * Pemindaian yang berhenti di `apps/web` melewatkan
 * `packages/core/src/auth/administration-access.ts`, yang sampai Fase 4 masih
 * memutuskan siapa boleh membuka workspace Administrasi lewat
 * `roleName === "OWNER"` — persis kelas retakan yang ditutup Fase 1, hanya
 * tinggal di paket sebelah.
 */
const coreFiles = collectSourceFiles(".", CORE_ROOT);
const coreOffenders = coreFiles.filter((file) => usesRoleLiteral(file, CORE_ROOT));

describe("otoritas peran tunggal", () => {
  test("server tidak memakai matriks seed sebagai otoritas runtime", () => {
    const runtime = sourceFiles.filter(
      (file) =>
        !file.includes("/fixtures/") &&
        !file.startsWith("lib/testing/") &&
        (file.startsWith("app/actions/") ||
          file.startsWith("app/api/") ||
          file.startsWith("server/") ||
          file.startsWith("lib/") ||
          file.includes("/server/")),
    );
    const seedAuthority =
      /\bactorHasPermission\s*\(|\bROLE_PERMISSIONS\s*\[|\bgetRoleDataScope\s*\(/;
    const remaining = runtime.filter((file) =>
      seedAuthority.test(stripComments(readFileSync(path.join(APP_ROOT, file), "utf8"))),
    );
    expect(remaining).toEqual([]);
  });

  test("tidak ada berkas baru yang memutuskan akses dari literal nama peran", () => {
    const allowed = [...MIGRATION_DEBT, ...PERMANENT_ROLE_NAME_USES];
    const unexpected = offenders.filter((file) => !allowed.includes(file));

    expect([...unexpected, ...webOffenders.map((file) => `web/${file}`)]).toEqual([]);
  });

  test("daftar utang tidak menyimpan entri yang sudah bersih", () => {
    const stale = MIGRATION_DEBT.filter((file) => !offenders.includes(file));

    expect(stale).toEqual([]);
  });

  test("utang migrasi Fase 1 sudah lunas", () => {
    expect(MIGRATION_DEBT).toEqual([]);
  });

  test("pengecualian permanen tetap menyebut nama peran", () => {
    // Entri yang sudah tidak memakainya harus keluar dari daftar ini juga.
    const stale = PERMANENT_ROLE_NAME_USES.filter((file) => !offenders.includes(file));

    expect(stale).toEqual([]);
  });

  test("paket core tidak memutuskan akses dari literal nama peran", () => {
    expect(coreOffenders).toEqual([]);
  });

  test("kemampuan administrasi diturunkan dari izin", () => {
    const source = readFileSync(path.join(CORE_ROOT, "auth", "administration-access.ts"), "utf8");

    expect(source).toContain('can("manage:users")');
    expect(source).toContain('can("manage:vendors")');
    expect(source).toContain('can("manage:roles")');
  });

  test("katalog izin memuat setiap kunci yang bisa disunting", () => {
    // Layar peran hanya bisa mencabut izin yang ia tampilkan, dan server hanya
    // menerima kunci yang dikenal `getAllPermissionKeys`. Keduanya harus
    // membaca daftar yang sama.
    const roleAccess = readFileSync(path.join(APP_ROOT, "lib/auth/role-access.ts"), "utf8");

    expect(roleAccess).toContain("getAllCatalogPermissionKeys");
  });

  test("cakupan data proyek hanya punya satu sumber", () => {
    // Tiga salinan aturan cakupan runtuh menjadi satu; halaman dan tool AI
    // sekarang membaca tabel yang sama.
    const scoping = readFileSync(path.join(APP_ROOT, "lib/auth/scoping.ts"), "utf8");
    const aiContext = readFileSync(path.join(APP_ROOT, "lib/ai/tools/context.ts"), "utf8");

    expect(scoping).toContain("getRoleDataScopeByName");
    // Cakupan halaman dibaca dari kolom `role.data_scope`, bukan tabel seed —
    // itulah yang membuat peran buatan Owner benar-benar punya cakupan.
    expect(scoping).not.toContain('from "@atria/core/auth/permissions"');
    expect(aiContext).not.toContain("GLOBAL_SCOPE_ROLES");
    expect(ROLE_LITERAL_PATTERNS.some((pattern) => pattern.test(scoping))).toBe(false);

    /*
     * Konteks tool AI tidak lagi menurunkan izin maupun cakupan dari nama
     * peran: keduanya diselesaikan dari database di route handler dan dititipkan
     * ke dalam closure. Untuk tool yang pekerjaannya menjelaskan izin, batas
     * yang menyimpang dari yang ditegakkan server bukan sekadar tidak rapi —
     * ia menjawab salah tepat pada pertanyaan yang diajukan karena bingung.
     */
    expect(aiContext).toContain("context.dataScope");
    expect(aiContext).toContain("context.permissions.includes");
    expect(aiContext).not.toContain("ROLE_PERMISSIONS[context.roleName]");

    const chatRoute = readFileSync(path.join(APP_ROOT, "app/api/ai/chat/route.ts"), "utf8");
    expect(chatRoute).toContain("getRoleAccess(session.user.roleId)");
  });
});
