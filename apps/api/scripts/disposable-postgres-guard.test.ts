import { expect, test } from "bun:test";
import { disposablePostgresTarget } from "./disposable-postgres-guard";

const LOCAL = "postgresql://postgres:ci-only@127.0.0.1:5432/atria_audit_baseline";

test("permits an explicitly named authenticated local disposable database", (): void => {
  expect(disposablePostgresTarget(LOCAL, "test").pathname).toBe("/atria_audit_baseline");
});

test.each([
  [undefined, "test"],
  [LOCAL, "production"],
  ["postgresql://postgres:ci-only@127.0.0.1:5432/development", "test"],
  ["postgresql://postgres:ci-only@company.neon.tech/atria_audit_baseline", "test"],
  ["postgresql://postgres:ci-only@127.0.0.1.evil.test/atria_audit_baseline", "test"],
  ["https://postgres:ci-only@localhost/atria_audit_baseline", "test"],
  ["postgresql://postgres@localhost/atria_audit_baseline", "test"],
  ["postgresql://postgres:ci-only@localhost/atria_audit_", "test"],
  [LOCAL + "?host=company.neon.tech", "test"],
  [LOCAL + "#unexpected", "test"],
  ["not-a-database-url", "test"],
])("rejects dangerous or ambiguous target %s in %s", (url, environment): void => {
  expect(() => disposablePostgresTarget(url, environment)).toThrow();
});
