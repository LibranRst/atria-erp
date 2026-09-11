import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Di-anchor ke lokasi file ini, bukan `process.cwd()`, supaya hasilnya sama
// dari mana pun suite dijalankan. `apps/mobile` sengaja di luar jangkauan:
// slice itu punya library primitive sendiri dan tidak memakai barrel
// `@/components/ui` maupun Tailwind.
const APP_ROOT = path.resolve(import.meta.dir, "..", "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..", "..");
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
  return path.relative(REPO_ROOT, filePath);
}

function consumerFiles(): string[] {
  return CONSUMER_ROOTS.flatMap((root) => collectSourceFiles(path.join(APP_ROOT, root))).filter(
    (filePath) => !filePath.endsWith(".stories.tsx"),
  );
}

function productionConsumerFiles(): string[] {
  return consumerFiles().filter((filePath) => !/\.test\.tsx?$/.test(filePath));
}

describe("shared UI import boundaries", () => {
  test("every production form sheet declares its dismissal contract", () => {
    const formSheetPattern = /<(FormSheet|OperationalFormSheet|WorkflowFormSheet)\b([\s\S]*?)>/g;
    const offenders = productionConsumerFiles().flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return [...source.matchAll(formSheetPattern)]
        .filter((match) => !match[2].includes("dismissal="))
        .map((match) => `${relativePath(filePath)} -> ${match[1]} has no dismissal policy`);
    });

    expect(offenders).toEqual([]);
  });

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

  test("application code uses AdaptiveSelect instead of the deprecated SheetSelect alias", () => {
    const deprecatedName = "Sheet" + "Select";
    const allowedFiles = new Set([
      path.join(APP_ROOT, "components", "ui", "index.ts"),
      path.join(APP_ROOT, "components", "ui", "form", "form-controls.tsx"),
      path.join(APP_ROOT, "components", "ui", "form", "select-form-controls.tsx"),
    ]);
    const offenders = collectSourceFiles(APP_ROOT)
      .filter((filePath) => !allowedFiles.has(filePath) && filePath !== import.meta.path)
      .filter((filePath) => readFileSync(filePath, "utf8").includes(deprecatedName))
      .map(relativePath);

    expect(offenders).toEqual([]);
  });

  test("application code uses semantic dialogs and sheets instead of deprecated overlay names", () => {
    const forbidden = new Set([
      "Bottom" + "Sheet",
      "Confirmation" + "Sheet",
      "Confirmation" + "Modal",
      "OperationSuccess" + "Sheet",
    ]);
    const offenders = consumerFiles().flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [
        ...source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*"@\/components\/ui";/g),
      ];
      return imports.flatMap((match) =>
        match[1]
          .split(",")
          .map(
            (name) =>
              name
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)[0],
          )
          .filter((name) => forbidden.has(name))
          .map((name) => `${relativePath(filePath)} imports deprecated ${name}`),
      );
    });

    expect(offenders).toEqual([]);
  });

  test("overlay infrastructure stays inside shared UI", () => {
    const infrastructureMarkers = [
      {
        label: "imports Floating UI directly",
        pattern: /from\s+["']@floating-ui\/react["']/,
      },
      {
        label: "creates a portal directly",
        pattern: /\bcreatePortal\s*\(/,
      },
      {
        label: "declares raw modal semantics",
        pattern: /aria-modal\s*=/,
      },
      {
        label: "imports raw DialogFrame",
        pattern: /import\s*\{[^}]*\bDialogFrame\b[^}]*\}\s*from\s*["']@\/components\/ui["']/s,
      },
    ] as const;
    const offenders = productionConsumerFiles().flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return infrastructureMarkers
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${relativePath(filePath)} ${label}`);
    });

    expect(offenders).toEqual([]);
  });

  /**
   * `CONTROL_LANGUAGE.md` mewajibkan satu set ikon: `AppIcon` yang didukung
   * Phosphor. Dua pustaka ikon dalam satu layar berarti dua bobot garis dan dua
   * ukuran optik, dan `AppIcon` juga yang membawa perlakuan ikon global.
   */
  test("no icon library other than the shared AppIcon is imported", () => {
    const FORBIDDEN = ["lucide-react", "@heroicons/react", "react-icons"];
    const uiFiles = collectSourceFiles(path.join(APP_ROOT, "components", "ui"));
    const offenders = [...consumerFiles(), ...uiFiles].flatMap((filePath) => {
      // Berkas tes boleh menyebut nama paketnya justru untuk menegaskan ketiadaannya.
      if (filePath.endsWith("app-icon.tsx") || /\.test\.tsx?$/.test(filePath)) return [];
      const source = readFileSync(filePath, "utf8");
      return FORBIDDEN.filter((pkg) => source.includes(`from "${pkg}"`)).map(
        (pkg) => `${relativePath(filePath)} imports ${pkg}`,
      );
    });

    expect(offenders).toEqual([]);
  });
});
