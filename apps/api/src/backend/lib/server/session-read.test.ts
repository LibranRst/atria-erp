import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { z } from "zod";

const evidenceSchema = z.object({ reads: z.number().int().nonnegative() });
const cases = [
  {
    mode: "sequential",
    reads: 1,
    name: "shares the real session reader across gate, required session and actor callers",
  },
  { mode: "inflight", reads: 1, name: "shares one pending auth lookup across concurrent callers" },
  { mode: "null", reads: 1, name: "memoizes an anonymous result within one request" },
  {
    mode: "new-context",
    reads: 2,
    name: "revalidates changed role and password state in a new context using the same Request object",
  },
  {
    mode: "new-context-revoked",
    reads: 2,
    name: "rejects a revoked session in the next context using the same Request object",
  },
  { mode: "headers", reads: 1, name: "retains cookie, native bearer and other request headers" },
  {
    mode: "fresh-header",
    reads: 2,
    name: "keeps explicit header session reads fresh after a session mutation",
  },
  { mode: "parallel-contexts", reads: 2, name: "keeps concurrent request identities isolated" },
  {
    mode: "workflow-public-actions",
    reads: 2,
    name: "isolates public action callers when a test workflow changes users",
  },
] as const;

for (const scenario of cases) {
  test(scenario.name, async (): Promise<void> => {
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        "--preload",
        "./scripts/test-preload.ts",
        "./src/backend/lib/server/fixtures/session-read-case.ts",
        scenario.mode,
      ],
      {
        cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", NODE_ENV: "test" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, error }).toEqual({ code: 0, error: "" });
    expect(evidenceSchema.parse(JSON.parse(output)).reads).toBe(scenario.reads);
  });
}
