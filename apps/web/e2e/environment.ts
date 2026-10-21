import { readFileSync } from "node:fs";

export type BrowserTestEnvironment = {
  readonly databaseUrl: string;
  readonly mode: string;
  readonly webUrl: string;
  readonly apiUrl: string;
};

export function browserTestEnvironment(): BrowserTestEnvironment {
  const file = process.env.ATRIA_E2E_ENV_FILE;
  const values: Record<string, string> = {};
  if (file) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (line.trim().startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      values[line.slice(0, separator).trim()] = line
        .slice(separator + 1)
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  const databaseUrl =
    process.env.ATRIA_LOCAL_TEST_DATABASE_URL ?? values.ATRIA_LOCAL_TEST_DATABASE_URL;
  const mode = process.env.ATRIA_LOCAL_TEST_MODE ?? values.ATRIA_LOCAL_TEST_MODE;
  if (!databaseUrl || mode !== "seeded")
    throw new Error("Browser tests require an explicitly configured seeded disposable database.");
  const database = new URL(databaseUrl);
  if (
    database.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(database.hostname) ||
    !/^\/atria_audit_[a-z0-9_]+$/.test(database.pathname)
  ) {
    throw new Error(
      "Browser tests only accept loopback atria_audit_* databases; development and production databases are rejected.",
    );
  }
  const webUrl = process.env.ATRIA_E2E_BASE_URL ?? "http://127.0.0.1:3210";
  const apiUrl = process.env.ATRIA_E2E_API_URL ?? "http://127.0.0.1:3211";
  for (const value of [webUrl, apiUrl]) {
    const target = new URL(value);
    if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname))
      throw new Error("Browser test servers must use explicit loopback HTTP origins.");
  }
  return { databaseUrl, mode, webUrl, apiUrl };
}
