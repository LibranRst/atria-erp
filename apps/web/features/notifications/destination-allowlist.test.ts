import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NOTIFICATION_REFERENCE_TYPES,
  notificationDestination,
} from "@atria/core/notifications/types";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const serviceWorkerPath = join(webRoot, "public", "notification-sw.js");
const backendRoot = join(webRoot, "..", "api/src/backend");

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

/** Rute halaman Next.js nyata, dengan segmen dinamis diubah jadi pola. */
async function pageRoutes(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes: string[] = [];
  for (const entry of entries) {
    const next = join(directory, entry.name);
    if (entry.isDirectory()) routes.push(...(await pageRoutes(next, `${prefix}/${entry.name}`)));
    else if (entry.name === "page.tsx") {
      const pattern = prefix.replace(/\/\([^)]*\)/g, "").replace(/\[[^\]]+\]/g, "[^/]+");
      routes.push(pattern === "" ? "/" : pattern);
    }
  }
  return routes;
}

/**
 * Setiap literal `actionUrl` yang benar-benar ditulis aplikasi. Sumbernya adalah
 * kode, bukan daftar manual: tujuan notifikasi baru yang ditambahkan di kemudian
 * hari ikut terperiksa tanpa harus mendaftarkannya lagi di sini.
 */
async function actionUrlLiterals(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const next = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await actionUrlLiterals(next)));
    else if (/\.tsx?$/.test(entry.name)) {
      const source = await readFile(next, "utf8");
      for (const match of source.matchAll(/actionUrl:\s*(?:"([^"]*)"|`([^`]*)`)/g)) {
        const literal = match[1] ?? match[2];
        if (literal) found.push(literal.replaceAll(/\$\{[^}]*\}/g, PROJECT_ID));
      }
    }
  }
  return found;
}

async function everyDestination(): Promise<{
  destinations: Set<string>;
  literalUrls: string[];
}> {
  const literalUrls = [
    ...(await actionUrlLiterals(join(webRoot, "app"))),
    ...(await actionUrlLiterals(join(backendRoot, "app"))),
    ...(await actionUrlLiterals(join(backendRoot, "server"))),
    ...(await actionUrlLiterals(join(backendRoot, "db"))),
  ];
  const destinations = new Set<string>();
  for (const referenceType of NOTIFICATION_REFERENCE_TYPES) {
    for (const actionUrl of literalUrls) {
      for (const projectId of [null, PROJECT_ID]) {
        const destination = notificationDestination({ referenceType, projectId, actionUrl });
        if (destination) destinations.add(destination);
      }
    }
  }
  return { destinations, literalUrls };
}

async function serviceWorkerAllowlist(): Promise<RegExp> {
  const source = await readFile(serviceWorkerPath, "utf8");
  const literal = /const ALLOWED_DESTINATION =\s*\n?\s*(\/.*\/);/.exec(source)?.[1];
  if (!literal) throw new Error("Allowlist service worker tidak ditemukan.");
  return new RegExp(literal.slice(1, literal.lastIndexOf("/")));
}

describe("tujuan notifikasi dan allowlist service worker", () => {
  test("setiap tujuan yang bisa dihasilkan notificationDestination diterima service worker", async () => {
    const allowed = await serviceWorkerAllowlist();
    const { destinations, literalUrls } = await everyDestination();
    expect(literalUrls.length).toBeGreaterThan(10);
    // Bukan hanya halaman pengganti `/notifications`: enumerasi harus mencakup
    // rute nyata, termasuk deep link proyek per tab.
    expect(destinations.size).toBeGreaterThan(8);
    for (const destination of destinations)
      expect(allowed.test(destination), `service worker menolak ${destination}`).toBe(true);
    expect([...destinations]).toContain(`/projects/${PROJECT_ID}?tab=rab`);
    expect([...destinations]).toContain(`/projects/${PROJECT_ID}?tab=stok`);
    expect([...destinations]).toContain("/approvals");
  });

  test("setiap tujuan mendarat di rute halaman yang benar-benar ada", async () => {
    const routes = (await pageRoutes(join(webRoot, "app"))).map(
      (route) => new RegExp(`^${route}$`),
    );
    const { destinations } = await everyDestination();
    const missing = [...destinations].filter(
      (destination) =>
        !routes.some((route) => route.test(new URL(destination, "https://atria.invalid").pathname)),
    );
    expect(missing).toEqual([]);
  });
});
