import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DevelopmentProcess } from "./dev-mobile";

function startSupervisor(
  definitions: readonly DevelopmentProcess[],
): Bun.Subprocess<"ignore", "pipe", "pipe"> {
  const source = `
    const { runDevelopmentProcesses } = await import(${JSON.stringify(path.join(import.meta.dir, "dev-mobile.ts"))});
    process.exit(await runDevelopmentProcesses(${JSON.stringify(definitions)}));
  `;
  return Bun.spawn([process.execPath, "--eval", source], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
}

function persistentProcess(directory: string): DevelopmentProcess {
  const descendantPid = path.join(directory, "descendant.pid");
  const workerPid = path.join(directory, "worker.pid");
  const descendant = `
    import { writeFileSync } from "node:fs";
    writeFileSync(${JSON.stringify(descendantPid)}, String(process.pid));
    setInterval(() => {}, 1000);
  `;
  const source = `
    import { writeFileSync } from "node:fs";
    writeFileSync(${JSON.stringify(workerPid)}, String(process.pid));
    Bun.spawn([process.execPath, "--eval", ${JSON.stringify(descendant)}], { stdout: "ignore", stderr: "ignore" });
    setInterval(() => {}, 1000);
  `;
  return {
    name: "persistent test worker",
    command: process.execPath,
    args: ["--eval", source],
    cwd: directory,
  };
}

async function waitForWorkers(directory: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (
      existsSync(path.join(directory, "worker.pid")) &&
      existsSync(path.join(directory, "descendant.pid"))
    )
      return;
    await Bun.sleep(20);
  }
  throw new Error("Test workers did not start.");
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function expectWorkersStopped(directory: string): Promise<void> {
  const pids = ["worker.pid", "descendant.pid"].map((file) =>
    Number(readFileSync(path.join(directory, file), "utf8")),
  );
  const deadline = Date.now() + 5_000;
  while (pids.some(processExists) && Date.now() < deadline) await Bun.sleep(20);
  for (const pid of pids) expect(processExists(pid)).toBe(false);
}

describe("mobile development process lifecycle", () => {
  test("a failing API stops Metro and its descendants and preserves the failure code", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "atria-dev-mobile-"));
    const failureSource = `
      import { existsSync } from "node:fs";
      setInterval(() => { if (existsSync(${JSON.stringify(path.join(directory, "descendant.pid"))})) process.exit(7); }, 20);
    `;
    const supervisor = startSupervisor([
      persistentProcess(directory),
      {
        name: "failing test API",
        command: process.execPath,
        args: ["--eval", failureSource],
        cwd: directory,
      },
    ]);
    try {
      expect(await supervisor.exited).toBe(7);
      await expectWorkersStopped(directory);
    } finally {
      supervisor.kill();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 12_000);

  test("Ctrl-C stops both development trees", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "atria-dev-mobile-"));
    const apiDirectory = path.join(directory, "api");
    const metroDirectory = path.join(directory, "metro");
    mkdirSync(apiDirectory);
    mkdirSync(metroDirectory);
    const supervisor = startSupervisor([
      persistentProcess(apiDirectory),
      persistentProcess(metroDirectory),
    ]);
    try {
      await Promise.all([waitForWorkers(apiDirectory), waitForWorkers(metroDirectory)]);
      supervisor.kill("SIGINT");
      expect(await supervisor.exited).toBe(130);
      await Promise.all([expectWorkersStopped(apiDirectory), expectWorkersStopped(metroDirectory)]);
    } finally {
      supervisor.kill();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 12_000);

  test("a missing executable ends the supervisor with a failure", async () => {
    const supervisor = startSupervisor([
      {
        name: "missing test API",
        command: path.join(tmpdir(), "atria-no-such-executable"),
        args: [],
        cwd: tmpdir(),
      },
    ]);
    try {
      expect(await supervisor.exited).toBe(1);
    } finally {
      supervisor.kill();
    }
  }, 5_000);
});
