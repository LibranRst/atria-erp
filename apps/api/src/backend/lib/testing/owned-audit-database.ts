/** Test-only boundary for a named standalone fixture or a runner-owned clone. */
export interface AuditDatabaseEnvironment {
  readonly testUrl?: string;
  readonly localUrl?: string;
  readonly nodeEnv?: string;
  readonly mode?: string;
  readonly runId?: string;
  readonly suiteIndex?: string;
  readonly suiteToken?: string;
}

export function assertOwnedAuditDatabase(
  standaloneName: string | null,
  environment: AuditDatabaseEnvironment = {
    testUrl: process.env.ATRIA_TEST_DATABASE_URL,
    localUrl: process.env.ATRIA_LOCAL_TEST_DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    mode: process.env.ATRIA_LOCAL_TEST_MODE,
    runId: process.env.ATRIA_AUDIT_RUN_ID,
    suiteIndex: process.env.ATRIA_AUDIT_SUITE_INDEX,
    suiteToken: process.env.ATRIA_AUDIT_SUITE_TOKEN,
  },
): void {
  const testUrl = environment.testUrl;
  const fail = (): never => {
    throw new Error("An explicitly owned local non-production audit database is required.");
  };
  if (
    environment.nodeEnv === "production" ||
    (standaloneName !== null && !/^atria_audit_[a-z0-9_]+$/.test(standaloneName)) ||
    !testUrl ||
    testUrl !== environment.localUrl
  )
    return fail();
  let target: URL;
  try {
    target = new URL(testUrl);
  } catch {
    return fail();
  }
  if (
    target.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(target.hostname) ||
    !target.port ||
    !target.username ||
    !target.password ||
    target.search ||
    target.hash
  )
    fail();
  if (standaloneName !== null && target.pathname === `/${standaloneName}`) return;
  const { runId, suiteIndex, suiteToken } = environment;
  if (
    environment.mode !== "seeded" ||
    !runId ||
    !/^[a-f0-9]{12}$/.test(runId) ||
    !suiteIndex ||
    !/^(?:0|[1-9][0-9]*)$/.test(suiteIndex) ||
    suiteToken !== `${runId}:${suiteIndex}` ||
    target.pathname !== `/atria_audit_${runId}_${suiteIndex}`
  )
    fail();
}
