interface DomFixtureOptions {
  readonly name: string;
  readonly fixture: string;
  readonly cwd: string;
  readonly timeoutMs: number;
}

interface DomFixtureResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export class DomFixtureTimeoutError extends Error {
  readonly pid: number;

  constructor(name: string, timeoutMs: number, pid: number, result: DomFixtureResult) {
    super(
      `${name} exceeded its ${timeoutMs}ms child deadline and was terminated.\n` +
        `stdout:\n${result.stdout || "(empty)"}\n` +
        `stderr:\n${result.stderr || "(empty)"}`,
    );
    this.name = "DomFixtureTimeoutError";
    this.pid = pid;
  }
}

/** Keep fixture cleanup inside a deadline shorter than the owning Bun test. */
export async function runDomFixture({
  name,
  fixture,
  cwd,
  timeoutMs,
}: DomFixtureOptions): Promise<DomFixtureResult> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("A DOM fixture deadline must be a positive number of milliseconds.");
  }
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const completion = Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]).then(([stdout, stderr, exitCode]): DomFixtureResult => ({ stdout, stderr, exitCode }));
  const expired = Symbol("DOM fixture deadline");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof expired>((resolve): void => {
    timer = setTimeout((): void => resolve(expired), timeoutMs);
  });

  try {
    const result = await Promise.race([completion, deadline]);
    if (result === expired) {
      if (child.exitCode === null) child.kill("SIGKILL");
      const output = await completion;
      throw new DomFixtureTimeoutError(name, timeoutMs, child.pid, output);
    }
    return result;
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited;
  }
}
