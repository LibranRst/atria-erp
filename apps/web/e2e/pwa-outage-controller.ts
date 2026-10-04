import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserTestEnvironment } from "./environment";

const settings = browserTestEnvironment();
const signalFile = join(mkdtempSync(join(tmpdir(), "atria-pwa-outage-")), "signal");

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${settings.webUrl}/login`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    const ready = response.ok;
    await response.body?.cancel();
    return ready;
  } catch {
    return false;
  }
}

async function until(check: () => boolean | Promise<boolean>, label: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function signal(): string {
  try {
    return readFileSync(signalFile, "utf8");
  } catch {
    return "";
  }
}

if (await reachable())
  throw new Error(
    "Stop the explicitly owned test web server first; controller never interrupts an existing process.",
  );
const spawnWeb = (): ReturnType<typeof Bun.spawn> =>
  Bun.spawn(["bun", "--no-env-file", "e2e/start-server.ts", "web"], {
    env: process.env,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
let web = spawnWeb();
await until(reachable, "initial web readiness");
const smoke = Bun.spawn(
  ["bunx", "playwright", "test", "e2e/pwa.pw.ts", "--output=test-results/pwa"],
  {
    env: {
      ...process.env,
      ATRIA_E2E_REUSE_SERVERS: "true",
      ATRIA_E2E_PWA: "true",
      ATRIA_E2E_OUTAGE_SIGNAL_FILE: signalFile,
    },
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  },
);

try {
  await until(() => signal() === "ready", "worker cache inspection");
  web.kill("SIGTERM");
  await web.exited;
  await until(async () => !(await reachable()), "actual server outage");
  await Bun.write(signalFile, "offline");
  await until(() => signal() === "reconnect", "offline fallback assertions");
  web = spawnWeb();
  await until(reachable, "restarted web readiness");
  await Bun.write(signalFile, "online");
  const code = await smoke.exited;
  if (code !== 0) throw new Error(`PWA smoke exited with ${code}`);
  console.log("PWA outage/reconnect passed; owned web remains available for inspection.");
} catch (error: unknown) {
  smoke.kill("SIGTERM");
  if (!(await reachable())) {
    web = spawnWeb();
    await until(reachable, "web recovery after harness failure");
  }
  console.error(error instanceof Error ? error.message : "PWA harness failed");
  process.exitCode = 1;
}
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.on(name, (): void => {
    web.kill(name);
  });
await web.exited;
