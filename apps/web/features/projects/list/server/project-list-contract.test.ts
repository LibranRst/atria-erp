import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..", "..");

/**
 * Kontrak loader daftar proyek untuk P2.2.
 *
 * Loader ini dipakai halaman web dan prosedur tRPC sekaligus, jadi dua hal
 * harus dijaga: ia tidak boleh lagi memakai `redirect()` (control-flow throw
 * Next tidak bisa menyeberang ke tRPC), dan scope proyek harus tetap ditegakkan
 * server lewat `scopeProjectQuery` — bukan dikirim klien.
 */
describe("project list loader contract", () => {
  const loaderSource = readFileSync(
    path.join(APP_ROOT, "features/projects/list/server/get-project-list-page-data.ts"),
    "utf8",
  );

  test("melaporkan status alih-alih melakukan redirect", () => {
    // Cocokkan impor dan pemanggilan sungguhan, bukan kata "redirect" yang
    // kebetulan muncul di komentar penjelas.
    expect(loaderSource).not.toMatch(
      /import\s*\{[^}]*\bredirect\b[^}]*\}\s*from\s*"next\/navigation"/,
    );
    expect(loaderSource).not.toMatch(/^\s*redirect\(/m);
    expect(loaderSource).not.toContain("requireServerSession");
    expect(loaderSource).toContain('status: "restricted"');
    expect(loaderSource).toContain('status: "ready"');
  });

  test("menerima Actor, bukan membaca sesi sendiri", () => {
    expect(loaderSource).toMatch(/getProjectListPageData\(\s*actor: Actor\s*\)/);
    expect(loaderSource).not.toContain("session.user");
  });

  test("scope proyek tetap ditegakkan server", () => {
    expect(loaderSource).toContain("scopeProjectQuery(actor.userId, roleName)");
  });

  test("kontrak list bersumber dari core, bukan tipe lokal", () => {
    const shim = readFileSync(
      path.join(APP_ROOT, "features/projects/list/types/project-list-types.ts"),
      "utf8",
    );
    const utilsShim = readFileSync(
      path.join(APP_ROOT, "features/projects/list/utils/project-list-utils.ts"),
      "utf8",
    );

    expect(shim).toContain("@atria/core/types/projects");
    expect(utilsShim).toContain("@atria/core/project/project-list");
  });

  test("screen.projects memakai activeProcedure seperti layar operasional lain", () => {
    const screenSource = readFileSync(path.join(APP_ROOT, "server/trpc/routers/screen.ts"), "utf8");
    const projectsLine = screenSource
      .split("\n")
      .find((line) => line.trimStart().startsWith("projects:"));

    expect(projectsLine).toBeDefined();
    expect(projectsLine).toContain("activeProcedure");
  });
});
