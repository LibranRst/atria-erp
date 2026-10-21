import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertPortsAvailable,
  developmentPorts,
  isWorkspaceDevCommand,
  matchesProcess,
  presetDefinitions,
  stopWorkspaceDevelopment,
  type DevelopmentPorts,
  type DevelopmentPreset,
} from "./dev-presets";

async function waitForFile(file: string): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (!existsSync(file) && Date.now() < deadline) await Bun.sleep(25);
  if (!existsSync(file)) throw new Error(`Fixture did not start: ${path.basename(file)}`);
}
function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function expectStopped(pids: readonly number[]): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (pids.some(processExists) && Date.now() < deadline) await Bun.sleep(25);
  for (const pid of pids) expect(processExists(pid)).toBe(false);
}
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port.");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
async function fixtureWorkspace(): Promise<{
  root: string;
  ports: DevelopmentPorts;
  environment: NodeJS.ProcessEnv;
}> {
  const root = mkdtempSync(path.join(tmpdir(), "atria dev presets "));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["apps/*"] }),
  );
  for (const app of ["api", "admin", "web", "mobile"]) {
    const directory = path.join(root, "apps", app);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({
        scripts: {
          dev: "bun worker.ts",
          "dev:preset": "bun worker.ts",
          start: "bun worker.ts",
          "types:api": "bun types.ts",
          ...(["web", "admin"].includes(app) ? { predev: "bun run --cwd ../api types:api" } : {}),
        },
      }),
    );
    writeFileSync(
      path.join(directory, "types.ts"),
      'import {existsSync,readFileSync,writeFileSync} from "node:fs";const count=existsSync("declarations.txt")?Number(readFileSync("declarations.txt","utf8")):0;writeFileSync("declarations.txt",String(count+1));',
    );
    writeFileSync(
      path.join(directory, "worker.ts"),
      `
      import { writeFileSync } from "node:fs";
      writeFileSync("worker.pid",String(process.pid));
      writeFileSync("environment.json",JSON.stringify({API_ORIGIN:process.env.API_ORIGIN,API_PUBLIC_URL:process.env.API_PUBLIC_URL,WEB_ORIGIN:process.env.WEB_ORIGIN,ADMIN_ORIGIN:process.env.ADMIN_ORIGIN,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_ATRIA_WEB_URL:process.env.NEXT_PUBLIC_ATRIA_WEB_URL,EXPO_PUBLIC_API_URL:process.env.EXPO_PUBLIC_API_URL,EXPO_PUBLIC_WEB_URL:process.env.EXPO_PUBLIC_WEB_URL,args:process.argv.slice(2)}));
      Bun.spawn([process.execPath,"--eval",'import {writeFileSync} from "node:fs";writeFileSync("descendant.pid",String(process.pid));setInterval(()=>{},1000);'], {stdout:"ignore",stderr:"ignore"});
      setInterval(()=>{},1000);
    `,
    );
  }
  const ports = {
    api: await freePort(),
    admin: await freePort(),
    web: await freePort(),
    mobile: await freePort(),
  };
  const environment = {
    ...process.env,
    ATRIA_DEV_API_PORT: String(ports.api),
    ATRIA_DEV_ADMIN_PORT: String(ports.admin),
    ATRIA_DEV_WEB_PORT: String(ports.web),
    ATRIA_DEV_METRO_PORT: String(ports.mobile),
    ATRIA_DEV_LAN_HOST: "192.168.1.23",
  };
  return { root, ports, environment };
}
function startFixture(
  root: string,
  environment: NodeJS.ProcessEnv,
): Bun.Subprocess<"ignore", "pipe", "pipe"> {
  const source = `const {runDevelopmentPreset}=await import(${JSON.stringify(path.join(import.meta.dir, "dev-presets.ts"))});process.exit(await runDevelopmentPreset("all",${JSON.stringify(root)},process.env));`;
  return Bun.spawn([process.execPath, "--eval", source], {
    cwd: root,
    env: environment,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
}
async function fixturePids(root: string): Promise<readonly number[]> {
  const result: number[] = [];
  for (const app of ["api", "admin", "web", "mobile"])
    for (const file of ["worker.pid", "descendant.pid"]) {
      const filename = path.join(root, "apps", app, file);
      await waitForFile(filename);
      result.push(Number(readFileSync(filename, "utf8")));
    }
  return result;
}

describe("development presets", () => {
  test("all five combinations launch exactly one API and the requested clients", () => {
    const ports = developmentPorts({});
    const expected: Readonly<Record<DevelopmentPreset, readonly string[]>> = {
      admin: ["api", "admin"],
      web: ["api", "web"],
      mobile: ["api", "mobile"],
      "admin-web": ["api", "admin", "web"],
      all: ["api", "admin", "web", "mobile"],
    };
    for (const preset of [
      "admin",
      "web",
      "mobile",
      "admin-web",
      "all",
    ] satisfies DevelopmentPreset[]) {
      const definitions = presetDefinitions(preset, "/repo with spaces", ports, "192.168.1.5");
      expect(definitions.map((entry) => path.basename(entry.cwd))).toEqual([...expected[preset]]);
      expect(definitions.filter((entry) => path.basename(entry.cwd) === "api")).toHaveLength(1);
      expect(definitions.every((entry) => entry.env?.API_ORIGIN === "http://localhost:3001")).toBe(
        true,
      );
    }
    const definitions = presetDefinitions("all", "/repo", ports, "192.168.1.5");
    expect(definitions[0]?.env?.WEB_ORIGIN).toBe("http://localhost:3003");
    expect(definitions[3]?.env?.EXPO_PUBLIC_WEB_URL).toBe("http://192.168.1.5:3003");
  });
  test("rejects invalid or colliding ports and preserves an occupied listener", async () => {
    expect(() => developmentPorts({ ATRIA_DEV_API_PORT: "0" })).toThrow();
    expect(() => developmentPorts({ ATRIA_DEV_WEB_PORT: "3000garbage" })).toThrow();
    await expect(assertPortsAvailable([3020, 3020])).rejects.toThrow("berbeda");
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No address.");
      await expect(assertPortsAvailable([address.port])).rejects.toThrow("sedang dipakai");
      expect(server.listening).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  test("process discovery excludes unrelated Node, builds and database/operator scripts", () => {
    const root = "/repo with spaces";
    expect(isWorkspaceDevCommand("/usr/bin/bun run dev", root, root)).toBe(true);
    expect(
      isWorkspaceDevCommand("node scripts/dev-lan.mjs", path.join(root, "apps/web"), root),
    ).toBe(true);
    expect(
      isWorkspaceDevCommand("bun --watch src/index.ts", path.join(root, "apps/api"), root),
    ).toBe(true);
    expect(isWorkspaceDevCommand("bun run dev", "/other-project", root)).toBe(false);
    expect(isWorkspaceDevCommand("node unrelated.js", root, root)).toBe(false);
    expect(isWorkspaceDevCommand("bun run db:seed", path.join(root, "apps/api"), root)).toBe(false);
    expect(isWorkspaceDevCommand("bun run build", root, root)).toBe(false);
    expect(isWorkspaceDevCommand('bun --eval "bun run dev"', root, root)).toBe(false);
    expect(isWorkspaceDevCommand("bun scripts/dev-presets.ts stop", root, root)).toBe(false);
    expect(matchesProcess({ pid: 123, startedAt: "old" }, { pid: 123, startedAt: "new" })).toBe(
      false,
    );
  });
  test("IPv6-only listeners are also protected from port conflicts", async () => {
    const server = createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen({ port: 0, host: "::1", ipv6Only: true }, resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No IPv6 address.");
      await expect(assertPortsAvailable([address.port])).rejects.toThrow("sedang dipakai");
      expect(server.listening).toBe(true);
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  test("stop terminates all registered companions/descendants and preserves an unrelated worker", async () => {
    const fixture = await fixtureWorkspace(),
      supervisor = startFixture(fixture.root, fixture.environment);
    const unrelated = Bun.spawn([process.execPath, "--eval", "setInterval(()=>{},1000)"], {
      cwd: fixture.root,
      stdout: "ignore",
      stderr: "ignore",
    });
    try {
      const pids = await fixturePids(fixture.root);
      expect(readFileSync(path.join(fixture.root, "apps/api/declarations.txt"), "utf8")).toBe("1");
      const apiEnv: unknown = JSON.parse(
        readFileSync(path.join(fixture.root, "apps/api/environment.json"), "utf8"),
      );
      expect(apiEnv).toMatchObject({
        API_ORIGIN: `http://localhost:${fixture.ports.api}`,
        ADMIN_ORIGIN: `http://localhost:${fixture.ports.admin}`,
        WEB_ORIGIN: `http://localhost:${fixture.ports.web}`,
      });
      expect(await stopWorkspaceDevelopment(fixture.root)).toBeGreaterThan(0);
      await supervisor.exited;
      await expectStopped(pids);
      expect(processExists(unrelated.pid)).toBe(true);
      expect(existsSync(path.join(fixture.root, ".atria-dev/run.json"))).toBe(false);
    } finally {
      supervisor.kill();
      unrelated.kill();
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 20_000);
  test("Ctrl-C removes state and all four process trees", async () => {
    const fixture = await fixtureWorkspace(),
      supervisor = startFixture(fixture.root, fixture.environment);
    try {
      const pids = await fixturePids(fixture.root);
      supervisor.kill("SIGINT");
      expect(await supervisor.exited).toBe(130);
      await expectStopped(pids);
      expect(existsSync(path.join(fixture.root, ".atria-dev/run.json"))).toBe(false);
    } finally {
      supervisor.kill();
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 20_000);
  test("a preparation failure preserves its code and launches no clients", async () => {
    const fixture = await fixtureWorkspace();
    writeFileSync(path.join(fixture.root, "apps/api/types.ts"), "process.exit(7);");
    const supervisor = startFixture(fixture.root, fixture.environment);
    try {
      expect(await supervisor.exited).toBe(7);
      expect(existsSync(path.join(fixture.root, "apps/admin/worker.pid"))).toBe(false);
      expect(existsSync(path.join(fixture.root, ".atria-dev/run.json"))).toBe(false);
    } finally {
      supervisor.kill();
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 10_000);
  test("stop discovers manually started Atria dev trees while preserving another checkout", async () => {
    const fixture = await fixtureWorkspace(),
      other = await fixtureWorkspace();
    const manual = Bun.spawn([process.execPath, "run", "dev"], {
      cwd: path.join(fixture.root, "apps/api"),
      stdout: "ignore",
      stderr: "ignore",
    });
    const unrelated = Bun.spawn([process.execPath, "run", "dev"], {
      cwd: path.join(other.root, "apps/api"),
      stdout: "ignore",
      stderr: "ignore",
    });
    try {
      const files = ["worker.pid", "descendant.pid"];
      for (const directory of [fixture.root, other.root])
        for (const file of files) await waitForFile(path.join(directory, "apps/api", file));
      const pids = files.map((file) =>
        Number(readFileSync(path.join(fixture.root, "apps/api", file), "utf8")),
      );
      expect(await stopWorkspaceDevelopment(fixture.root)).toBeGreaterThan(0);
      await manual.exited;
      await expectStopped(pids);
      expect(processExists(unrelated.pid)).toBe(true);
    } finally {
      manual.kill();
      await stopWorkspaceDevelopment(other.root);
      unrelated.kill();
      rmSync(fixture.root, { recursive: true, force: true });
      rmSync(other.root, { recursive: true, force: true });
    }
  }, 20_000);
  test("stale registry identities cannot kill a reused/unrelated PID", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "atria-stale-dev-"));
    const unrelated = Bun.spawn([process.execPath, "--eval", "setInterval(()=>{},1000)"], {
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    });
    try {
      mkdirSync(path.join(root, ".atria-dev"));
      writeFileSync(
        path.join(root, ".atria-dev/run.json"),
        JSON.stringify({
          root: realpathSync(root),
          owner: { pid: unrelated.pid, startedAt: "not-the-current-generation" },
          children: [],
        }),
      );
      expect(await stopWorkspaceDevelopment(root)).toBe(0);
      expect(processExists(unrelated.pid)).toBe(true);
      expect(existsSync(path.join(root, ".atria-dev/run.json"))).toBe(false);
    } finally {
      unrelated.kill();
      rmSync(root, { recursive: true, force: true });
    }
  }, 10_000);
});
