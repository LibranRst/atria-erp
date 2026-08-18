import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

/**
 * Kontrak `screen.projectOverview` untuk P2.4.
 *
 * Loader ini sengaja tidak memakai `getProjectDetailData` (loader detail web
 * yang memuat seluruh pohon RAP/RAB/vendor bill/movement) — itu yang membuat
 * bootstrap native ringan. Test ini membuktikan batasnya tetap ditegakkan
 * lewat pembacaan sumber, sama seperti kontrak daftar proyek di P2.2.
 */
describe("project overview loader contract", () => {
  const source = readFileSync(
    path.join(APP_ROOT, "server/usecases/project/get-project-overview.ts"),
    "utf8",
  );

  test("menerima Actor eksplisit, bukan membaca sesi sendiri", () => {
    expect(source).toMatch(/getProjectOverviewData\(\s*actor: Actor,\s*projectId: string,?\s*\)/);
    expect(source).not.toContain("requireServerSession");
  });

  test("scope proyek ditegakkan lewat assertProjectAccess", () => {
    expect(source).toContain("assertProjectAccess(projectId, actor.userId, actor.roleName)");
  });

  test("melaporkan status alih-alih redirect() atau notFound()", () => {
    expect(source).toContain('status: "restricted"');
    expect(source).toContain('status: "notFound"');
    expect(source).not.toMatch(/\bnotFound\(\)/);
    expect(source).not.toMatch(/\bredirect\(/);
  });

  test("tidak memuat loader detail penuh atau vendor payment", () => {
    expect(source).not.toMatch(/\bimport\b[^;]*getProjectDetailData/);
    expect(source).not.toMatch(/\bvendorPayment\b/);
  });

  test("screen.projectOverview memakai activeProcedure dan input Zod", () => {
    const screenSource = readFileSync(path.join(APP_ROOT, "server/trpc/routers/screen.ts"), "utf8");
    expect(screenSource).toContain("projectOverview: activeProcedure");
    expect(screenSource).toContain(".input(projectOverviewInputSchema)");
  });
});
