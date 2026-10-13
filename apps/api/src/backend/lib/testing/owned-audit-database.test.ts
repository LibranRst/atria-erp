import { expect, test } from "bun:test";
import { assertOwnedAuditDatabase, type AuditDatabaseEnvironment } from "./owned-audit-database";

const standalone = "atria_audit_quick_start";
const url = (database: string): string =>
  `postgresql://fixture:private@127.0.0.1:32777/${database}`;
const clone = "atria_audit_123456abcdef_15";
const owned: AuditDatabaseEnvironment = {
  testUrl: url(clone),
  localUrl: url(clone),
  nodeEnv: "test",
  mode: "seeded",
  runId: "123456abcdef",
  suiteIndex: "15",
  suiteToken: "123456abcdef:15",
};
test("known standalone fixture and matching generated clone retain strict ownership", () => {
  expect(() =>
    assertOwnedAuditDatabase(standalone, {
      testUrl: url(standalone),
      localUrl: url(standalone),
      nodeEnv: "test",
    }),
  ).not.toThrow();
  expect(() => assertOwnedAuditDatabase(standalone, owned)).not.toThrow();
  expect(() => assertOwnedAuditDatabase(null, owned)).not.toThrow();
  expect(() =>
    assertOwnedAuditDatabase(null, {
      testUrl: url(standalone),
      localUrl: url(standalone),
      nodeEnv: "test",
    }),
  ).toThrow();
});
test.each([
  { ...owned, nodeEnv: "production" },
  { ...owned, mode: "empty" },
  { ...owned, suiteToken: "another-run" },
  { ...owned, suiteIndex: "16" },
  { ...owned, runId: undefined },
  { ...owned, localUrl: undefined },
  { ...owned, localUrl: url("atria_audit_other") },
  {
    ...owned,
    testUrl: url("atria_audit_reconciliation"),
    localUrl: url("atria_audit_reconciliation"),
  },
  { ...owned, testUrl: url("development"), localUrl: url("development") },
  {
    ...owned,
    testUrl: "postgresql://fixture:private@production.invalid:5432/atria_audit_quick_start",
    localUrl: "postgresql://fixture:private@production.invalid:5432/atria_audit_quick_start",
  },
  { ...owned, testUrl: `${url(clone)}?unsafe=true`, localUrl: `${url(clone)}?unsafe=true` },
])("unknown, mismatched and development targets never inherit an audit grant %#", (environment) => {
  expect(() => assertOwnedAuditDatabase(standalone, environment)).toThrow("explicitly owned local");
});
