import { expect, test } from "bun:test";
import {
  developmentDatabaseTarget,
  developmentSeedOptions,
  isLoopbackDevelopmentTarget,
} from "./development-seed-guard";

const LOCAL = "postgresql://postgres:local-only@127.0.0.1:5432/atria_development";
const NEON =
  "postgresql://neondb_owner:fixture-only@ep-example.ap-southeast-1.aws.neon.tech/neondb";

test.each([
  LOCAL,
  "postgres://postgres:local-only@localhost:5432/atria_development",
  "postgresql://postgres:local-only@[::1]:5432/atria_development",
  LOCAL + "?sslmode=disable",
])("accepts explicit loopback application database %s", (url: string): void => {
  expect(developmentDatabaseTarget(url, "development").pathname).toBe("/atria_development");
});

test.each([
  NEON,
  NEON + "?sslmode=require",
  NEON + "?sslmode=verify-full&channel_binding=require",
  "postgres://neondb_owner:fixture-only@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  "postgresql://postgres:fixture-only@company.neon.tech/atria_development?sslmode=require",
])("accepts configured Neon development database %s", (url: string): void => {
  const target = developmentDatabaseTarget(url, "development");
  expect(target.href).toBe(url);
  expect(isLoopbackDevelopmentTarget(target)).toBe(false);
});

test("only loopback targets select the optional TCP transport", (): void => {
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
    const target = developmentDatabaseTarget(
      `postgresql://user:pass@${hostname}/atria_dev`,
      "test",
    );
    expect(isLoopbackDevelopmentTarget(target)).toBe(true);
  }
  expect(isLoopbackDevelopmentTarget(developmentDatabaseTarget(NEON, "test"))).toBe(false);
});

test.each([
  undefined,
  "not-a-database-url",
  "https://postgres:local-only@localhost/atria_development",
  "postgresql://postgres:local-only@company.invalid/atria_development",
  "postgresql://postgres:local-only@company.neon.tech.evil.invalid/atria_development",
  "postgresql://postgres:local-only@neon.tech/atria_development",
  "postgresql://postgres:local-only@invalid-.neon.tech/atria_development",
  "postgresql://postgres:local-only@-invalid.neon.tech/atria_development",
  "postgresql://postgres@company.neon.tech/atria_development?sslmode=require",
  "postgresql://company.neon.tech/atria_development?sslmode=require",
  "postgresql://postgres:local-only@127.0.0.1.evil.test/atria_development",
  "postgresql://postgres:local-only@0.0.0.0/atria_development",
  "postgresql://postgres:local-only@localhost/",
  "postgresql://postgres:local-only@localhost/postgres",
  "postgresql://postgres:local-only@localhost/template0",
  "postgresql://postgres:local-only@localhost/template1",
  "postgresql://postgres:local-only@localhost/atria_development/other",
  LOCAL + "?host=company.neon.tech",
  LOCAL + "?hostaddr=203.0.113.1",
  LOCAL + "?sslmode=disable&host=company.neon.tech",
  LOCAL + "?sslmode=disable&sslmode=disable",
  LOCAL + "#unexpected",
  NEON + "?host=remote.invalid",
  NEON + "?hostaddr=203.0.113.1",
  NEON + "?options=-c%20search_path=other",
  NEON + "?sslmode=disable",
  NEON + "?channel_binding=disable",
  NEON + "?sslmode=require&sslmode=verify-full",
  NEON + "?sslmode=require&channel_binding=require&channel_binding=require",
  NEON + "#unexpected",
])("rejects ambiguous or remote target %s", (url: string | undefined): void => {
  expect((): URL => developmentDatabaseTarget(url, "development")).toThrow();
});

test.each([LOCAL, NEON])(
  "production cannot override the development guard %s",
  (url: string): void => {
    expect((): URL => developmentDatabaseTarget(url, "production")).toThrow("NODE_ENV=production");
  },
);

test("normal seed is empty-only; verify-only does not request reset", (): void => {
  expect(developmentSeedOptions([])).toEqual({ reset: false, verifyOnly: false });
  expect(developmentSeedOptions(["--verify"])).toEqual({ reset: false, verifyOnly: true });
  expect(developmentSeedOptions(["--reset", "--confirm-reset"])).toEqual({
    reset: true,
    verifyOnly: false,
  });
});

test.each([
  { args: ["--reset"] },
  { args: ["--confirm-reset"] },
  { args: ["--reset", "--confirm-reset", "--verify"] },
  { args: ["--allow-production"] },
  { args: ["--force"] },
])("rejects unsafe or conflicting flags %j", (row: { readonly args: readonly string[] }): void => {
  expect(() => developmentSeedOptions(row.args)).toThrow();
});
