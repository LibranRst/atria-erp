import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export type DevelopmentProcess = {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
};

type RunningProcess = {
  readonly child: ChildProcess;
  readonly exited: Promise<void>;
};

function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const args = ["/pid", String(child.pid), "/T", ...(signal === "SIGKILL" ? ["/F"] : [])];
    const taskkill = spawn("taskkill", args, { stdio: "ignore" });
    taskkill.once("error", (): void => {
      child.kill(signal);
    });
    taskkill.once("exit", (code: number | null): void => {
      if (code !== 0) child.kill(signal);
    });
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
      child.kill(signal);
    }
  }
}

/** Stops both development trees if either fails or the user stops the runner. */
export async function runDevelopmentProcesses(
  definitions: readonly DevelopmentProcess[],
): Promise<number> {
  if (definitions.length === 0) throw new Error("At least one development process is required.");
  const running: RunningProcess[] = [];
  let stopping = false;
  let complete: (exitCode: number) => void = (): void => {};
  const result = new Promise<number>((resolve) => {
    complete = resolve;
  });

  async function stop(exitCode: number): Promise<void> {
    if (stopping) return;
    stopping = true;
    for (const item of running) signalProcessTree(item.child, "SIGTERM");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const allExited = Promise.all(running.map((item) => item.exited));
    const graceful = await Promise.race([
      allExited.then(() => true),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), 3_000);
      }),
    ]);
    clearTimeout(timeout);
    if (!graceful) {
      for (const item of running) signalProcessTree(item.child, "SIGKILL");
      await allExited;
    }
    complete(exitCode);
  }

  function onInterrupt(): void {
    void stop(130);
  }
  function onTerminate(): void {
    void stop(143);
  }
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  try {
    for (const definition of definitions) {
      console.log(`Starting ${definition.name}`);
      const child = spawn(definition.command, [...definition.args], {
        cwd: definition.cwd,
        stdio: "inherit",
        detached: process.platform !== "win32",
      });
      const exited = new Promise<void>((resolve) => {
        child.once("error", (error: Error): void => {
          console.error(`${definition.name} could not start: ${error.message}`);
          resolve();
          void stop(1);
        });
        child.once("exit", (code: number | null, signal: NodeJS.Signals | null): void => {
          resolve();
          if (!stopping) {
            console.error(`${definition.name} stopped (${signal ?? code ?? "unknown"}).`);
            void stop(code && code > 0 ? code : 1);
          }
        });
      });
      running.push({ child, exited });
    }
    return await result;
  } catch (error: unknown) {
    console.error("Could not start mobile development:", error);
    void stop(1);
    return await result;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

if (import.meta.main) {
  const workspaceRoot = path.resolve(import.meta.dir, "..");
  process.exit(
    await runDevelopmentProcesses([
      {
        name: "Atria API (:3001)",
        command: process.execPath,
        args: ["run", "dev"],
        cwd: path.join(workspaceRoot, "apps/api"),
      },
      {
        name: "Expo Metro (:8081)",
        command: process.execPath,
        args: ["run", "start", "--port", "8081"],
        cwd: path.join(workspaceRoot, "apps/mobile"),
      },
    ]),
  );
}
