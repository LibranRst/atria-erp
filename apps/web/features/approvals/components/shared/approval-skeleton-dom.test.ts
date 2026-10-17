import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Approval skeleton mounts the native HeroUI collection and preserves mobile and native fallback", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./approval-skeleton-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("desktop, mobile and native approval skeletons mounted safely");
}, 30_000);
