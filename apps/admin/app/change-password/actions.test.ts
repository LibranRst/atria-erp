import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("temporary-password gate uses the session-revoking operation and ordinary password change preserves this session", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./fixtures/actions-case.ts", import.meta.url));
  const processResult = Bun.spawn([process.execPath, "run", fixture], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, errors, exitCode] = await Promise.all([
    new Response(processResult.stdout).text(),
    new Response(processResult.stderr).text(),
    processResult.exited,
  ]);
  expect(errors).toBe("");
  expect(exitCode).toBe(0);
  expect(output).toContain("password-actions: passed");
});
