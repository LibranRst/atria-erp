import { mock } from "bun:test";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Bun's isolated workspace peers must use the same React dispatcher as SSR.
const adminRequire = createRequire(import.meta.url);
const canonicalReact = await import("react");
const canonicalReactPath = realpathSync(adminRequire.resolve("react"));
const workspaceModules = fileURLToPath(new URL("../../../node_modules/", import.meta.url));
const isolatedModules = path.join(workspaceModules, ".bun");
const reactDirectories = [path.join(workspaceModules, "react")];
if (existsSync(isolatedModules)) {
  for (const entry of readdirSync(isolatedModules)) {
    if (entry.startsWith("react@")) {
      reactDirectories.push(path.join(isolatedModules, entry, "node_modules", "react"));
    }
  }
}
for (const directory of reactDirectories) {
  const entry = path.join(directory, "index.js");
  if (existsSync(entry) && realpathSync(entry) !== canonicalReactPath) {
    mock.module(entry, () => canonicalReact);
  }
}
mock.module("server-only", () => ({}));
