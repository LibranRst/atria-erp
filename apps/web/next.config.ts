import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating development badge overlaps the chat attachment target at 320px.
  devIndicators: false,
  // Keep verification builds separate from an already running development server.
  distDir: process.env.ATRIA_NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Di monorepo, Next menelusuri dependensi dari direktori app-nya dan akan
  // melewatkan `node_modules` yang di-hoist ke root workspace.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  /**
   * Berkas service worker tidak boleh di-cache lama oleh CDN: selama peramban
   * masih memegang salinan lama, perbaikan pada penangan push maupun halaman
   * offline tidak akan pernah sampai ke pengguna. `Service-Worker-Allowed`
   * menegaskan scope `/` supaya worker tetap boleh mengendalikan seluruh origin.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      {
        source: "/notification-sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
