import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection, createServer } from "node:net";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { runDevelopmentProcesses, type DevelopmentProcess } from "./dev-mobile";

export type DevelopmentPreset = "admin" | "web" | "mobile" | "admin-web" | "all";
type Service = "api" | "admin" | "web" | "mobile";
export interface DevelopmentPorts {
  readonly api: number;
  readonly admin: number;
  readonly web: number;
  readonly mobile: number;
}
export interface ProcessIdentity {
  readonly pid: number;
  readonly startedAt: string;
}
interface ProcessRecord extends ProcessIdentity {
  readonly parentPid: number;
  readonly command: string;
}
interface RunRegistry {
  readonly root: string;
  readonly owner: ProcessIdentity;
  readonly children: readonly ProcessIdentity[];
}

const services: Readonly<Record<DevelopmentPreset, readonly Service[]>> = {
  admin: ["api", "admin"],
  web: ["api", "web"],
  mobile: ["api", "mobile"],
  "admin-web": ["api", "admin", "web"],
  all: ["api", "admin", "web", "mobile"],
};

export function developmentPorts(
  environment: Readonly<Record<string, string | undefined>>,
): DevelopmentPorts {
  function port(key: string, fallback: number): number {
    const raw = environment[key];
    const value = raw === undefined ? fallback : /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < 1 || value > 65535)
      throw new Error(`${key} harus port antara 1 dan 65535.`);
    return value;
  }
  return {
    api: port("ATRIA_DEV_API_PORT", 3001),
    admin: port("ATRIA_DEV_ADMIN_PORT", 3002),
    web: port("ATRIA_DEV_WEB_PORT", 3003),
    mobile: port("ATRIA_DEV_METRO_PORT", 8081),
  };
}

function lanHostname(environment: Readonly<Record<string, string | undefined>>): string {
  const override = environment.ATRIA_DEV_LAN_HOST?.trim();
  if (override) {
    if (!/^[\w.-]+$/.test(override))
      throw new Error("ATRIA_DEV_LAN_HOST harus hostname atau IPv4 tanpa port/path.");
    return override;
  }
  const interfaces = Object.entries(networkInterfaces()).sort(
    ([a], [b]) => Number(b === "en0") - Number(a === "en0"),
  );
  for (const [, entries] of interfaces) {
    const address = entries?.find(
      (entry) =>
        !entry.internal &&
        entry.family === "IPv4" &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
    );
    if (address) return address.address;
  }
  return "127.0.0.1";
}

export function presetDefinitions(
  preset: DevelopmentPreset,
  root: string,
  ports: DevelopmentPorts,
  mobileHost: string,
): readonly DevelopmentProcess[] {
  const apiOrigin = `http://localhost:${ports.api}`,
    webOrigin = `http://localhost:${ports.web}`,
    adminOrigin = `http://localhost:${ports.admin}`;
  const shared = { NODE_ENV: "development", API_ORIGIN: apiOrigin };
  return services[preset].map((service): DevelopmentProcess => {
    const app = service === "mobile" ? "mobile" : service;
    const common = {
      name: `Atria ${service} (:${ports[service]})`,
      command: process.execPath,
      cwd: path.join(root, "apps", app),
    };
    if (service === "api")
      return {
        ...common,
        args: ["run", "dev"],
        env: {
          ...shared,
          PORT: String(ports.api),
          HOST: "0.0.0.0",
          API_PUBLIC_URL: apiOrigin,
          BETTER_AUTH_URL: apiOrigin,
          WEB_ORIGIN: webOrigin,
          ADMIN_ORIGIN: adminOrigin,
        },
      };
    if (service === "mobile")
      return {
        ...common,
        args: ["run", "start", "--port", String(ports.mobile)],
        env: {
          ...shared,
          EXPO_PUBLIC_API_URL: `http://${mobileHost}:${ports.api}`,
          EXPO_PUBLIC_WEB_URL: `http://${mobileHost}:${ports.web}`,
        },
      };
    return {
      ...common,
      args: ["run", "dev:preset", "--hostname", "0.0.0.0", "--port", String(ports[service])],
      env: {
        ...shared,
        ...(service === "admin"
          ? { NEXT_PUBLIC_ATRIA_WEB_URL: webOrigin }
          : { NEXT_PUBLIC_APP_URL: webOrigin }),
      },
    };
  });
}

/** Process metadata is never printed: command lines can contain private values. */
function processRecords(): readonly ProcessRecord[] {
  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid=$_.ProcessId; parentPid=$_.ParentProcessId; startedAt=$_.CreationDate.ToUniversalTime().ToString('o'); command=$_.CommandLine } } | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error("Tidak dapat membaca proses development.");
    const raw: unknown = JSON.parse(result.stdout);
    const rows: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
    return rows.filter(
      (row): row is ProcessRecord =>
        isIdentity(row) &&
        "parentPid" in row &&
        typeof row.parentPid === "number" &&
        "command" in row &&
        typeof row.command === "string",
    );
  }
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,lstart=,args="], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
  });
  if (result.status !== 0) throw new Error("Tidak dapat membaca proses development.");
  return result.stdout.split("\n").flatMap((line): readonly ProcessRecord[] => {
    const match =
      /^\s*(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/.exec(line);
    return match
      ? [
          {
            pid: Number(match[1]),
            parentPid: Number(match[2]),
            startedAt: match[3]!.replace(/\s+/g, " "),
            command: match[4]!,
          },
        ]
      : [];
  });
}

function isIdentity(value: unknown): value is ProcessIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    "pid" in value &&
    typeof value.pid === "number" &&
    Number.isInteger(value.pid) &&
    value.pid > 1 &&
    "startedAt" in value &&
    typeof value.startedAt === "string" &&
    value.startedAt.length > 0
  );
}
export function matchesProcess(
  expected: ProcessIdentity,
  current: ProcessIdentity | undefined,
): boolean {
  return current?.pid === expected.pid && current.startedAt === expected.startedAt;
}
function readRegistry(root: string): RunRegistry | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path.join(root, ".atria-dev/run.json"), "utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "root" in value &&
      value.root === root &&
      "owner" in value &&
      isIdentity(value.owner) &&
      "children" in value &&
      Array.isArray(value.children) &&
      value.children.every(isIdentity)
    )
      return { root, owner: value.owner, children: value.children };
  } catch {
    /* Missing or invalid state never authorizes killing a PID. */
  }
  return null;
}
function processCwd(pid: number): string | null {
  try {
    if (process.platform === "linux") return realpathSync(`/proc/${pid}/cwd`);
    if (process.platform === "win32") return null;
    const result = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
    });
    const line = result.stdout.split("\n").find((entry) => entry.startsWith("n"));
    return line ? realpathSync(line.slice(1)) : null;
  } catch {
    return null;
  }
}

/** Whitelist entrypoints as well as cwd; never select database tools or every Node process. */
export function isWorkspaceDevCommand(command: string, cwd: string | null, root: string): boolean {
  if (!cwd || !/^(?:\S*[/\\])?(?:bun|node|next|expo)(?:\.exe)?(?:\s|$)/.test(command)) return false;
  if (/(?:^|\s)(?:--eval|-e)(?:\s|=)/.test(command)) return false;
  if (cwd === root)
    return (
      (/(?:^|\s)(?:scripts[/\\]dev-(?:presets|mobile)\.ts)(?:\s|$)/.test(command) &&
        !/(?:\s)stop(?:\s|$)/.test(command)) ||
      /\bbun\s+(?:run\s+)?dev(?::(?:api|web|admin|expo|mobile|default|admin-api|web-api|mobile-api|admin-web-api|all))?(?:\s|$)/.test(
        command,
      )
    );
  if (cwd === path.join(root, "apps/api"))
    return /\bbun\s+(?:run\s+dev(?:\s|$)|--watch\s+src[/\\]index\.ts(?:\s|$))/.test(command);
  if (cwd === path.join(root, "apps/mobile"))
    return /\bbun\s+run\s+start(?:\s|$)|(?:expo|@expo[/\\]cli)[^\n]*\bstart(?:\s|$)/.test(command);
  if (cwd === path.join(root, "apps/web") || cwd === path.join(root, "apps/admin"))
    return /\bbun\s+run\s+dev(?::(?:default|preset))?(?:\s|$)|(?:scripts[/\\]dev-lan\.mjs)(?:\s|$)|\bnext\s+dev(?:\s|$)|next[/\\]dist[/\\]bin[/\\]next\s+dev(?:\s|$)|\bbun\s+run\s+e2e[/\\]fixture-api\.ts(?:\s|$)/.test(
      command,
    );
  return false;
}

function protectedAncestors(records: readonly ProcessRecord[]): ReadonlySet<number> {
  const result = new Set<number>();
  let pid = process.pid;
  while (pid > 0 && !result.has(pid)) {
    result.add(pid);
    pid = records.find((record) => record.pid === pid)?.parentPid ?? 0;
  }
  return result;
}
function signalIdentity(identity: ProcessIdentity, signal: NodeJS.Signals): void {
  if (
    !matchesProcess(
      identity,
      processRecords().find((record) => record.pid === identity.pid),
    )
  )
    return;
  try {
    if (process.platform === "win32")
      spawnSync(
        "taskkill",
        ["/PID", String(identity.pid), "/T", ...(signal === "SIGKILL" ? ["/F"] : [])],
        { stdio: "ignore" },
      );
    else process.kill(identity.pid, signal);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
  }
}

export async function stopWorkspaceDevelopment(directory: string): Promise<number> {
  const root = realpathSync(directory),
    records = processRecords(),
    excluded = protectedAncestors(records);
  const registry = readRegistry(root),
    targets = new Map<number, ProcessIdentity>();
  for (const identity of registry ? [registry.owner, ...registry.children] : []) {
    const current = records.find((record) => record.pid === identity.pid);
    if (matchesProcess(identity, current) && !excluded.has(identity.pid))
      targets.set(identity.pid, identity);
  }
  for (const record of records) {
    if (
      !excluded.has(record.pid) &&
      isWorkspaceDevCommand(record.command, processCwdForCandidate(record), root)
    )
      targets.set(record.pid, record);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records)
      if (targets.has(record.parentPid) && !targets.has(record.pid) && !excluded.has(record.pid)) {
        targets.set(record.pid, record);
        changed = true;
      }
  }
  for (const identity of targets.values()) signalIdentity(identity, "SIGTERM");
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const current = processRecords();
    if (
      ![...targets.values()].some((identity) =>
        matchesProcess(
          identity,
          current.find((record) => record.pid === identity.pid),
        ),
      )
    )
      break;
    await Bun.sleep(50);
  }
  for (const identity of targets.values()) signalIdentity(identity, "SIGKILL");
  const owner = registry
    ? processRecords().find((record) => record.pid === registry.owner.pid)
    : undefined;
  if (!registry || !matchesProcess(registry.owner, owner))
    rmSync(path.join(root, ".atria-dev/run.json"), { force: true });
  return targets.size;
}

function processCwdForCandidate(record: ProcessRecord): string | null {
  return /^(?:\S*[/\\])?(?:bun|node|next|expo)(?:\.exe)?(?:\s|$)/.test(record.command)
    ? processCwd(record.pid)
    : null;
}

export async function assertPortsAvailable(ports: readonly number[]): Promise<void> {
  const reserved: ReturnType<typeof createServer>[] = [];
  try {
    if (new Set(ports).size !== ports.length)
      throw new Error("Port layanan dalam preset harus berbeda.");
    for (const port of ports) {
      // Bun/macOS can permit wildcard binds beside an IPv6-specific listener.
      // Probe loopback first so localhost never resolves to another service.
      for (const host of ["127.0.0.1", "::1"]) {
        const occupied = await new Promise<boolean>((resolve) => {
          const socket = createConnection({ port, host });
          const finish = (value: boolean): void => {
            socket.destroy();
            resolve(value);
          };
          socket.once("connect", () => finish(true));
          socket.once("error", () => finish(false));
          socket.setTimeout(300, () => finish(false));
        });
        if (occupied)
          throw new Error(
            `Port ${port} sedang dipakai. Jalankan bun run dev:stop untuk proses Atria, atau pilih port ATRIA_DEV_* lain.`,
          );
      }
      for (const host of ["0.0.0.0", "::"]) {
        const server = createServer();
        let listening = false;
        await new Promise<void>((resolve, reject) => {
          server.once("error", (error: NodeJS.ErrnoException) => {
            if (host === "::" && ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code ?? "")) {
              resolve();
              return;
            }
            reject(
              new Error(
                `Port ${port} sedang dipakai. Jalankan bun run dev:stop untuk proses Atria, atau pilih port ATRIA_DEV_* lain.`,
              ),
            );
          });
          server.listen({ port, host, ipv6Only: host === "::", exclusive: true }, () => {
            listening = true;
            resolve();
          });
        });
        if (listening) reserved.push(server);
      }
    }
  } finally {
    await Promise.all(
      reserved.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  }
}

export async function runDevelopmentPreset(
  preset: DevelopmentPreset,
  directory: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const root = realpathSync(directory),
    ports = developmentPorts(environment);
  const definitions = presetDefinitions(preset, root, ports, lanHostname(environment));
  await assertPortsAvailable(services[preset].map((service) => ports[service]));
  const stateFile = path.join(root, ".atria-dev/run.json"),
    existing = readRegistry(root);
  if (
    existing &&
    matchesProcess(
      existing.owner,
      processRecords().find((record) => record.pid === existing.owner.pid),
    )
  )
    throw new Error("Preset Atria masih berjalan. Jalankan bun run dev:stop terlebih dahulu.");
  mkdirSync(path.dirname(stateFile), { recursive: true });
  const owner = processRecords().find((record) => record.pid === process.pid);
  if (!owner) throw new Error("Tidak dapat mendaftarkan supervisor development.");
  if (existsSync(stateFile))
    throw new Error(
      "State development masih ada. Jalankan bun run dev:stop sebelum memilih preset baru.",
    );
  const children: ProcessIdentity[] = [];
  const save = (exclusive = false): void => {
    const content = JSON.stringify(
      { root, owner: { pid: owner.pid, startedAt: owner.startedAt }, children },
      null,
      2,
    );
    if (exclusive) writeFileSync(stateFile, content, { flag: "wx", mode: 0o600 });
    else {
      const temporary = `${stateFile}.${process.pid}.tmp`;
      writeFileSync(temporary, content, { mode: 0o600 });
      renameSync(temporary, stateFile);
    }
  };
  save(true);
  function register(pid: number | undefined): void {
    const record = processRecords().find((entry) => entry.pid === pid);
    if (record) {
      children.push({ pid: record.pid, startedAt: record.startedAt });
      save();
    }
  }
  let preparingPid: number | undefined;
  function stopPreparation(): void {
    if (preparingPid) {
      try {
        if (process.platform === "win32")
          spawnSync("taskkill", ["/PID", String(preparingPid), "/T", "/F"], { stdio: "ignore" });
        else process.kill(-preparingPid, "SIGTERM");
      } catch {
        /* Child already ended. */
      }
    }
    rmSync(stateFile, { force: true });
    process.exit(130);
  }
  process.once("SIGINT", stopPreparation);
  process.once("SIGTERM", stopPreparation);
  try {
    console.log(
      `Preset ${preset}: ${definitions.map((definition) => definition.name).join(" + ")}`,
    );
    console.log(
      services[preset]
        .map((service) =>
          service === "mobile"
            ? `Metro :${ports.mobile}`
            : `${service} http://localhost:${ports[service]}`,
        )
        .join(" | "),
    );
    console.log(
      "Menyiapkan kontrak API sekali; Ctrl-C atau bun run dev:stop menghentikan preset ini.",
    );
    const preparation = spawn(process.execPath, ["run", "types:api"], {
      cwd: path.join(root, "apps/api"),
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: { ...process.env, ...environment, NODE_ENV: "development" },
    });
    preparingPid = preparation.pid;
    register(preparation.pid);
    const prepared = await new Promise<number>((resolve) => {
      preparation.once("error", () => resolve(1));
      preparation.once("exit", (code) => resolve(code ?? 1));
    });
    preparingPid = undefined;
    if (prepared !== 0) return prepared;
    process.off("SIGINT", stopPreparation);
    process.off("SIGTERM", stopPreparation);
    return await runDevelopmentProcesses(
      definitions.map((definition) => ({
        ...definition,
        env: { ...environment, ...definition.env },
      })),
      { onSpawn: (child) => register(child.pid) },
    );
  } finally {
    process.off("SIGINT", stopPreparation);
    process.off("SIGTERM", stopPreparation);
    const current = readRegistry(root);
    if (current?.owner.pid === process.pid && current.owner.startedAt === owner.startedAt)
      rmSync(stateFile, { force: true });
  }
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, "..");
  const selected = process.argv[2];
  try {
    if (selected === "stop")
      console.log(
        `Development Atria dihentikan (${await stopWorkspaceDevelopment(root)} proses teridentifikasi).`,
      );
    else if (
      selected === "admin" ||
      selected === "web" ||
      selected === "mobile" ||
      selected === "admin-web" ||
      selected === "all"
    )
      process.exit(await runDevelopmentPreset(selected, root));
    else throw new Error("Pilih preset admin, web, mobile, admin-web, all, atau stop.");
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : "Preset development gagal.");
    process.exit(1);
  }
}
