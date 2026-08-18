import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Di monorepo, Next menelusuri dependensi dari direktori app-nya dan akan
  // melewatkan `node_modules` yang di-hoist ke root workspace.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
