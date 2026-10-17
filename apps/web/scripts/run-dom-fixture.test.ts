import assert from "node:assert/strict";
import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DomFixtureTimeoutError, runDomFixture } from "./run-dom-fixture";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const fixtures = await mkdtemp(path.join(tmpdir(), "paduna-dom-fixture-lifecycle-"));
afterAll(async (): Promise<void> => {
  await rm(fixtures, { recursive: true, force: true });
});

async function fixture(name: string, source: string): Promise<string> {
  const filename = path.join(fixtures, `${name}.ts`);
  await writeFile(filename, source);
  return filename;
}

function assertReaped(pid: number): void {
  expect((): void => {
    process.kill(pid, 0);
  }).toThrow(/ESRCH|No such process/);
}

test("DOM fixture runner returns all successful output after its child exits", async (): Promise<void> => {
  const filename = await fixture("success", "console.log(`completed:${process.pid}`);");
  const result = await runDomFixture({
    name: "Successful lifecycle fixture",
    fixture: filename,
    cwd,
    timeoutMs: 2_000,
  });
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  const match = /^completed:(\d+)\n$/.exec(result.stdout);
  assert.ok(match);
  assertReaped(Number(match[1]));
});

test("DOM fixture runner preserves failed child status and both output streams", async (): Promise<void> => {
  const filename = await fixture(
    "failure",
    'console.log("before failure"); console.error("fixture assertion failed"); process.exit(7);',
  );
  const result = await runDomFixture({
    name: "Failed lifecycle fixture",
    fixture: filename,
    cwd,
    timeoutMs: 2_000,
  });
  expect(result).toEqual({
    exitCode: 7,
    stdout: "before failure\n",
    stderr: "fixture assertion failed\n",
  });
});

test("DOM fixture deadline kills and reaps a hanging child with useful diagnostics", async (): Promise<void> => {
  const filename = await fixture(
    "hang",
    'console.log("fixture entered"); console.error("last known boundary"); setInterval(() => {}, 1_000);',
  );
  let failure: unknown;
  try {
    await runDomFixture({
      name: "Hanging lifecycle fixture",
      fixture: filename,
      cwd,
      timeoutMs: 300,
    });
  } catch (error: unknown) {
    failure = error;
  }
  assert.ok(failure instanceof DomFixtureTimeoutError);
  expect(failure.message).toContain("Hanging lifecycle fixture exceeded its 300ms child deadline");
  expect(failure.message).toContain("fixture entered");
  expect(failure.message).toContain("last known boundary");
  assertReaped(failure.pid);
});
