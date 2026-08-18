import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(import.meta.dir);

/**
 * `@atria/core` di-bundle oleh Next.js (server maupun client) dan oleh Metro
 * (React Native) sekaligus. Satu impor Node/DOM/DB di sini akan gagal saat
 * bundling di salah satu sisi, dan kegagalannya muncul jauh dari penyebabnya —
 * jadi batasnya ditegakkan di sini, bukan lewat konvensi.
 */
const FORBIDDEN_SPECIFIERS = [
  "next",
  "server-only",
  "react",
  "react-dom",
  "react-native",
  "drizzle-orm",
  "@neondatabase/serverless",
  "pg",
  "better-auth",
  "framer-motion",
  "clsx",
  "tailwind-merge",
  "@google/genai",
  "ai",
  "sonner",
  "fs",
  "path",
  "crypto",
  "os",
  "child_process",
];

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return entryPath.endsWith(".ts") ? [entryPath] : [];
  });
}

function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g),
    ...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]!);
}

function relativePath(filePath: string): string {
  return path.relative(SRC_ROOT, filePath);
}

describe("shared core purity", () => {
  const sourceFiles = collectSourceFiles(SRC_ROOT);

  test("no module reaches outside the pure domain layer", () => {
    /**
     * File test dikecualikan: alasan aturan ini adalah bundling (Next dan
     * Metro), dan test tidak pernah ikut di-bundle. Test boleh memakai
     * `node:fs` untuk fixture. Aturan `@/` dan self-reference di bawah tetap
     * berlaku untuk semua file, termasuk test.
     */
    const offenders = sourceFiles
      .filter((filePath) => !filePath.endsWith(".test.ts"))
      .flatMap((filePath) =>
        importSpecifiers(readFileSync(filePath, "utf8"))
          .filter((specifier) => {
            const bare = specifier.replace(/^node:/, "");
            return FORBIDDEN_SPECIFIERS.some(
              (forbidden) => bare === forbidden || bare.startsWith(`${forbidden}/`),
            );
          })
          .map((specifier) => `${relativePath(filePath)} -> ${specifier}`),
      );

    expect(offenders.sort()).toEqual([]);
  });

  test("no module reaches back into the app via the @/ alias", () => {
    const offenders = sourceFiles.flatMap((filePath) =>
      importSpecifiers(readFileSync(filePath, "utf8"))
        .filter((specifier) => specifier.startsWith("@/"))
        .map((specifier) => `${relativePath(filePath)} -> ${specifier}`),
    );

    expect(offenders.sort()).toEqual([]);
  });

  test("no module self-references the package instead of importing relatively", () => {
    const offenders = sourceFiles.flatMap((filePath) =>
      importSpecifiers(readFileSync(filePath, "utf8"))
        .filter((specifier) => specifier.startsWith("@atria/core"))
        .map((specifier) => `${relativePath(filePath)} -> ${specifier}`),
    );

    expect(offenders.sort()).toEqual([]);
  });
});
