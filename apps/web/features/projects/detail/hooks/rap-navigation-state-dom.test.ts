import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("RAP desktop navigation restores only the matching source and retains pending source adoption", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./rap-navigation-state-dom.fixture.tsx", import.meta.url));
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
    "RAP navigation retains scoped desktop URL, resize and confirmed stage intent",
  );
}, 30000);
