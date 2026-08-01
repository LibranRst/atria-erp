import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * Kode aplikasi mengonsumsi primitif UI bersama lewat satu jalur:
 * `@/components/ui`. Jalur dalam menyebar detail implementasi ke seluruh
 * aplikasi dan membuat perpindahan file jadi perubahan besar-besaran, seperti
 * yang terjadi saat 278 impor dalam harus disentuh sekaligus.
 *
 * `components/ui/**` sendiri tetap memakai jalur relatif/dalam — barrel-nya
 * tidak boleh mengimpor dirinya sendiri.
 */
const CONSUMER_ROOTS = ["app", "features", "components/layout"] as const;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function relativePath(filePath: string): string {
  return path.relative(WORKSPACE_ROOT, filePath);
}

function consumerFiles(): string[] {
  return CONSUMER_ROOTS.flatMap((root) =>
    collectSourceFiles(path.join(WORKSPACE_ROOT, root)),
  ).filter((filePath) => !filePath.endsWith(".stories.tsx"));
}

describe("shared UI import boundaries", () => {
  test("application code imports shared UI through the barrel only", () => {
    const offenders = consumerFiles().flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const deepImports = [...source.matchAll(/from\s+"(@\/components\/ui\/[^"]+)"/g)].map(
        (match) => match[1],
      );
      return deepImports.map((specifier) => `${relativePath(filePath)} -> ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  test("a feature never re-exports a shared UI primitive as its own", () => {
    const offenders = consumerFiles().flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const passThrough = [
        ...source.matchAll(/export\s+\{[^}]*\}\s+from\s+"(@\/components\/ui[^"]*)"/g),
      ];
      return passThrough.map((match) => `${relativePath(filePath)} re-exports ${match[1]}`);
    });

    expect(offenders).toEqual([]);
  });
});
