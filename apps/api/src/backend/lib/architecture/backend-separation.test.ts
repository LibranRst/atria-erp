import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { z } from "zod";

const API_ROOT = path.resolve(import.meta.dir, "..", "..", "..", "..");
const FORBIDDEN_FRAMEWORK =
  /^(?:next(?:\/|$)|react(?:-dom)?(?:\/|$)|server-only$|@atria\/web(?:\/|$)|@\/)/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(file) && !/\.(?:test|stories)\.tsx?$/.test(file) ? [file] : [];
  });
}

function importedModules(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const modules: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modules.push(node.moduleSpecifier.text);
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

describe("independent backend boundary", () => {
  test("API runtime modules cannot import Next, React or the frontend app", () => {
    const files = [
      ...sourceFiles(path.join(API_ROOT, "src")),
      ...sourceFiles(path.join(API_ROOT, "scripts")),
    ];
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap((file) =>
      importedModules(file)
        .filter((specifier) => FORBIDDEN_FRAMEWORK.test(specifier))
        .map((specifier) => `${path.relative(API_ROOT, file)} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  test("backend workspace installs no frontend framework dependency", () => {
    const manifest = z
      .object({
        dependencies: z.record(z.string(), z.string()).optional(),
        devDependencies: z.record(z.string(), z.string()).optional(),
      })
      .parse(JSON.parse(readFileSync(path.join(API_ROOT, "package.json"), "utf8")));
    const packages = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    expect(packages.filter((name) => FORBIDDEN_FRAMEWORK.test(name))).toEqual([]);
  });

  test("public HTTP entry points remain explicitly sanctioned", () => {
    const source = readFileSync(path.join(API_ROOT, "src/app.ts"), "utf8");
    const paths = [...source.matchAll(/app\.(?:get|post|on)\(\s*(?:\[[^\]]*\],\s*)?"([^"]+)"/g)]
      .map((match) => match[1])
      .sort();
    expect(paths).toEqual([
      "/api/ai/chat",
      "/api/auth/*",
      "/api/internal/material-analysis",
      "/api/internal/notifications",
      "/api/internal/web-rpc",
      "/api/media/*",
      "/api/notifications/stream",
      "/api/trpc/*",
      "/health",
      "/ready",
    ]);
  });
});
