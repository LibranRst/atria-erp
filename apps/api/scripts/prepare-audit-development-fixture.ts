import { assertOwnedAuditDatabase } from "../src/backend/lib/testing/owned-audit-database";

// Run-owned clone only: never a named existing database or the seeded template.
assertOwnedAuditDatabase(null);
if (process.env.ATRIA_TEST_DEVELOPMENT_SEED !== "true")
  throw new Error("Explicit development audit profile required.");
const { db, pool } = await import("../src/backend/db");
const { project } = await import("../src/backend/db/schema");
const { seedDemoDatabase } = await import("../src/backend/db/seed");
const { verifyDevelopmentDataset } = await import("../src/backend/db/seed/development-validation");
const log = console.log;
try {
  if ((await db.select({ id: project.id }).from(project).limit(1)).length > 0)
    throw new Error("Development audit preparation requires a fresh empty clone.");
  // The synthetic seeder prints fixture passwords. Do not save them to CI logs.
  console.log = (): void => undefined;
  await seedDemoDatabase({ profile: "development" });
  await verifyDevelopmentDataset(db);
} finally {
  console.log = log;
  await pool.end();
}
console.info("Run-owned development profile prepared and verified.");
