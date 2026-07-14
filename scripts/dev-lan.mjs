import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(rootDir, "node_modules", ".bin", "next");
const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
const nodeOptions = [existingNodeOptions, "--require=./scripts/prefer-lan-network-host.cjs"]
  .filter(Boolean)
  .join(" ");

console.log("Starting Next.js dev server with localhost and LAN access enabled");

const child = spawn(nextBin, ["dev"], {
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
