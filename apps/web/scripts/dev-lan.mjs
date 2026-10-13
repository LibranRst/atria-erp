import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Di monorepo, Bun meng-hoist `.bin/` ke root workspace, jadi binary `next`
 * belum tentu ada di `apps/web/node_modules`. Telusuri ke atas sampai ketemu.
 */
function resolveNextBin() {
  let dir = rootDir;

  while (true) {
    const candidate = path.join(dir, "node_modules", ".bin", "next");
    if (existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Tidak menemukan binary `next` di node_modules mana pun.");
    }
    dir = parent;
  }
}

const nextBin = resolveNextBin();
const preloadPath = path.join(rootDir, "scripts", "prefer-lan-network-host.cjs");
const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
// NODE_OPTIONS diurai ulang oleh proses Node anak. Path workspace dapat memuat
// spasi, jadi kirim sebagai string JSON agar tetap menjadi satu argumen require.
const nodeOptions = [existingNodeOptions, `--require=${JSON.stringify(preloadPath)}`]
  .filter(Boolean)
  .join(" ");

console.log("Starting Next.js dev server with localhost and LAN access enabled");

const child = spawn(nextBin, ["dev", ...process.argv.slice(2)], {
  cwd: rootDir,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
