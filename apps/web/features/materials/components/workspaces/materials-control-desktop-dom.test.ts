import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("actual material count returns focus after adopting an out-of-preview draft removes its invoker", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./materials-count-focus-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain(
    "Actual material count dismissal restores stable activity focus without writes",
  );
}, 30_000);

test("material owner preserves out-of-preview count drafts and defers source refresh through resize and pending work", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./materials-control-desktop-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain(
    "material owner preserves remote count and transfer drafts, pending work, and deferred source across resize",
  );
}, 30000);

test("real material workspace respects shared action-menu limits with all Owner capabilities", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./materials-control-desktop-render.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain(
    "real material workspace renders all desktop tabs with complete Owner actions through shared ActionMenu contracts",
  );
}, 30000);
