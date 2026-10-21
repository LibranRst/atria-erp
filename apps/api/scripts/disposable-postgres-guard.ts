/** Operator-only safety gate. This module never reads DATABASE_URL or connects. */
export function disposablePostgresTarget(
  databaseUrl: string | undefined,
  nodeEnvironment: string | undefined,
): URL {
  if (nodeEnvironment === "production") {
    throw new Error("Disposable preparation is forbidden in production.");
  }
  if (!databaseUrl) throw new Error("ATRIA_LOCAL_TEST_DATABASE_URL must be explicit.");
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("Disposable database URL is malformed.");
  }
  if (
    target.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(target.hostname) ||
    !/^\/atria_audit_[a-z0-9_]+$/.test(target.pathname) ||
    !target.username ||
    !target.password ||
    target.search !== "" ||
    target.hash !== ""
  ) {
    throw new Error("Only authenticated loopback atria_audit_* databases are allowed.");
  }
  return target;
}
