import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const WEB_ROOT = path.resolve(import.meta.dir, "..", "..");
const FORBIDDEN_RUNTIME =
  /^(?:@backend(?:\/|$)|@\/db(?:\/|$)|@atria\/api(?:\/|$)|drizzle-orm(?:\/|$)|@neondatabase\/|pg$|postgres$|better-auth(?:\/adapters\/|\/plugins\/|$))/;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(file) && !/\.(?:test|stories)\.tsx?$/.test(file) ? [file] : [];
  });
}

function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const modules: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const typesOnly =
        clause?.isTypeOnly ||
        (!clause?.name &&
          named &&
          ts.isNamedImports(named) &&
          named.elements.every((element) => element.isTypeOnly));
      if (!typesOnly) modules.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const named = node.exportClause;
      const typesOnly =
        node.isTypeOnly ||
        (named &&
          ts.isNamedExports(named) &&
          named.elements.every((element) => element.isTypeOnly));
      if (!typesOnly) modules.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) modules.push(specifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return modules;
}

describe("frontend delegates backend authority", () => {
  const files = ["app", "features", "lib", "server", "components"].flatMap((directory) =>
    sourceFiles(path.join(WEB_ROOT, directory)),
  );

  test("web has no runtime import of database, API implementation or server auth", () => {
    const offenders = files.flatMap((file) =>
      runtimeImports(file)
        .filter(
          (specifier) => FORBIDDEN_RUNTIME.test(specifier) || /(?:^|\/)api\/src\//.test(specifier),
        )
        .map((specifier) => `${path.relative(WEB_ROOT, file)} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  test("database schema and connection live outside the web workspace", () => {
    expect(existsSync(path.join(WEB_ROOT, "db"))).toBe(false);
    const databaseUsers = files
      .filter((file) => /process\.env\.DATABASE_URL\b/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(WEB_ROOT, file));
    expect(databaseUsers).toEqual([]);
  });
});
