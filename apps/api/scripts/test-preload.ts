/** Test imports must never inherit the application's live database connection. */
const testDatabaseUrl =
  process.env.ATRIA_TEST_DATABASE_URL ?? process.env.ATRIA_TEST_EMPTY_DATABASE_URL;
process.env.DATABASE_URL =
  testDatabaseUrl ??
  "postgresql://atria-test-guard:disabled@127.0.0.1:1/atria_test_database_not_configured";
process.env.BETTER_AUTH_SECRET ??= "api-test-only-auth-secret-never-use-in-production";
