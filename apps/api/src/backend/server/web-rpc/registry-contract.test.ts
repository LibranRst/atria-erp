import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("every typed web operation has an explicit runtime dispatch", () => {
  const filename = `${import.meta.dir}/registry.ts`;
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declared: string[] = [];
  const dispatched: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "operations" &&
      node.initializer
    ) {
      let initializer = node.initializer;
      while (ts.isAsExpression(initializer)) initializer = initializer.expression;
      if (ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name))
            declared.push(property.name.text);
        }
      }
    }
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression))
      dispatched.push(node.expression.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(declared.length).toBeGreaterThan(200);
  expect(dispatched.sort()).toEqual(declared.sort());
});
