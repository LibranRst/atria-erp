import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Di-anchor ke lokasi file ini, bukan ke `process.cwd()`. Dengan begitu hasilnya
 * sama entah suite dijalankan lewat `bun --filter`, dari dalam `apps/web`, atau
 * dengan menunjuk file ini langsung.
 */
const APP_ROOT = path.resolve(import.meta.dir, "..", "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..", "..");
const SOURCE_ROOTS = ["app", "features", "lib", "server"] as const;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function relativePath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some((item) => item.kind === kind))
  );
}

function isAsyncFunctionExpression(node: ts.Expression | undefined): boolean {
  return Boolean(
    node &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    hasModifier(node, ts.SyntaxKind.AsyncKeyword),
  );
}

function isUseServerModule(sourceFile: ts.SourceFile): boolean {
  return sourceFile.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use server",
  );
}

function getInvalidServerExports(sourceFile: ts.SourceFile): string[] {
  return sourceFile.statements.flatMap((statement) => {
    if (
      ts.isFunctionDeclaration(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      return hasModifier(statement, ts.SyntaxKind.AsyncKeyword)
        ? []
        : [statement.name?.text ?? "anonymous function"];
    }

    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      return statement.declarationList.declarations
        .filter((declaration) => !isAsyncFunctionExpression(declaration.initializer))
        .map((declaration) => declaration.name.getText(sourceFile));
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) return [];
      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)
      ) {
        return [];
      }
      return [statement.getText(sourceFile)];
    }

    if (
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isExportAssignment(statement)) &&
      (ts.isExportAssignment(statement) || hasModifier(statement, ts.SyntaxKind.ExportKeyword))
    ) {
      return [statement.getText(sourceFile)];
    }

    return [];
  });
}

describe("server module architecture", () => {
  const sourceFiles = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.join(APP_ROOT, root)));

  test("feature domains do not use an ambiguous top-level actions folder", () => {
    const actionDirectories = readdirSync(path.join(APP_ROOT, "features"), {
      withFileTypes: true,
    }).flatMap((feature) => {
      if (!feature.isDirectory()) return [];
      const featurePath = path.join(APP_ROOT, "features", feature.name);
      return readdirSync(featurePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name === "actions")
        .map((entry) => relativePath(path.join(featurePath, entry.name)));
    });

    expect(actionDirectories).toEqual([]);
  });

  test("feature server modules declare the server-only boundary", () => {
    const unguardedServerModules = sourceFiles
      .filter(
        (filePath) =>
          filePath.startsWith(path.join(APP_ROOT, "features")) &&
          filePath.includes(`${path.sep}server${path.sep}`),
      )
      .filter((filePath) => !filePath.endsWith(".test.ts") && !filePath.endsWith(".test.tsx"))
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return !/^import ["']server-only["'];/m.test(source);
      })
      .map(relativePath);

    expect(unguardedServerModules).toEqual([]);
  });

  test("server use-case modules declare the server-only boundary", () => {
    const unguardedUseCases = sourceFiles
      .filter((filePath) => filePath.startsWith(path.join(APP_ROOT, "server")))
      .filter((filePath) => !filePath.endsWith(".test.ts") && !filePath.endsWith(".test.tsx"))
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return !/^import ["']server-only["'];/m.test(source);
      })
      .map(relativePath);

    expect(unguardedUseCases).toEqual([]);
  });

  test("the HTTP surface stays limited to the sanctioned route handlers", () => {
    const apiRoot = path.join(APP_ROOT, "app", "api");
    const handlers = collectSourceFiles(apiRoot)
      .filter((filePath) => path.basename(filePath) === "route.ts")
      .map((filePath) => path.relative(apiRoot, filePath).split(path.sep).join("/"))
      .sort();

    /**
     * Better Auth butuh permukaan HTTP; AI chat butuh transport token untuk
     * `useChat`; tRPC adalah satu-satunya jembatan untuk klien native, karena
     * React Native tidak bisa memanggil Server Action. Semua mutasi lain adalah
     * Server Action. Menambah entri keempat adalah keputusan desain, bukan
     * formalitas — perbarui daftar ini hanya bersama alasannya di CLAUDE.md.
     */
    expect(handlers).toEqual([
      "ai/chat/route.ts",
      "auth/[...better-auth]/route.ts",
      "trpc/[trpc]/route.ts",
    ]);
  });

  test("route pages delegate database access to server loaders", () => {
    const routePagesWithDirectDatabaseAccess = sourceFiles
      .filter(
        (filePath) =>
          filePath.startsWith(path.join(APP_ROOT, "app")) && path.basename(filePath) === "page.tsx",
      )
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return /from ["']@\/db(?:\/|["'])|from ["']drizzle-orm["']/.test(source);
      })
      .map(relativePath);

    expect(routePagesWithDirectDatabaseAccess).toEqual([]);
  });

  test('"use server" modules export only directly declared async runtime functions', () => {
    const invalidModules = sourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      if (!isUseServerModule(sourceFile)) return [];

      const invalidExports = getInvalidServerExports(sourceFile);
      return invalidExports.length > 0
        ? [`${relativePath(filePath)}: ${invalidExports.join(", ")}`]
        : [];
    });

    expect(invalidModules).toEqual([]);
  });
});
