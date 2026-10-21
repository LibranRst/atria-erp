import { mock } from "bun:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Actor } from "@backend/server/actor";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";

const accountId = "55555555-5555-5555-5555-555555555551";
const archivedId = "00000000-0000-4000-8000-000000000002";
const cashId = (index: number): string =>
  index === 120
    ? "dddddddd-dddd-dddd-dddd-dddddddddd09"
    : `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`;
const statementId = (index: number): string =>
  index === 120
    ? "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09"
    : `00000000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`;
const account = {
  id: accountId,
  name: "Operasional",
  bankName: "Bank fixture",
  tenantId: INSTANCE_TENANT_ID,
  isActive: true,
};
const now = new Date("2026-10-15T01:00:00Z");
const cashRows = Array.from({ length: 127 }, (_, index) => ({
  id: cashId(index),
  tenantId: INSTANCE_TENANT_ID,
  bankAccountId: index === 126 ? archivedId : accountId,
  bankAccount: { ...account, name: index === 126 ? "Rekening arsip" : "Operasional" },
  type: index % 2 === 0 ? "DEBIT" : "OUTFLOW",
  amount: `${index + 1}.10`,
  description: `Kas ${index}`,
  referenceType: null,
  referenceId: null,
  bankReference: `REF-${index}`,
  reconciled: false,
  createdAt: new Date(now.getTime() - index * 86_400_000),
  reconciliationExceptionReason: index === 1 ? "Dokumen sumber sedang ditelusuri" : null,
  reconciliationExceptionAt: index === 1 ? now : null,
  reconciliationExceptionBy: index === 1 ? { name: "Owner fixture" } : null,
}));
const statementRows = Array.from({ length: 127 }, (_, index) => ({
  id: statementId(index),
  tenantId: INSTANCE_TENANT_ID,
  isReconciled: false,
  importId: "fixture-import",
  import: {
    bankAccountId: index === 126 ? archivedId : accountId,
    bankAccount: { ...account },
    fileName: "fixture.csv",
  },
  type: index % 2 === 0 ? "INFLOW" : "CREDIT",
  amount: `${index + 1}.10`,
  description: `Mutasi ${index}`,
  transactionDate: new Date(now.getTime() - index * 86_400_000),
}));
const historyRows = Array.from({ length: 151 }, (_, index) => ({
  id: statementId(index + 200),
  tenantId: INSTANCE_TENANT_ID,
  isReconciled: true,
  importId: "fixture-import",
  import: { bankAccountId: accountId, bankAccount: account, fileName: "fixture.csv" },
  description: `Mutasi cocok ${index}`,
  transactionDate: now,
  createdAt: new Date(now.getTime() + index * 1000),
  matchedCashTransaction: {
    ...cashRows[0],
    id: cashId(index + 200),
    reconciled: true,
    reconciliationDate: new Date(now.getTime() - index * 1000),
    reconciledBy: { name: "Owner fixture" },
  },
}));
const conditions: SQL[] = [];
let reads = 0;
let failSource = false;
let emptySource = false;
type FindOptions = {
  readonly where: SQL;
  readonly limit?: number;
  readonly with?: Record<string, unknown>;
};
type CountQuery = {
  from: () => CountQuery;
  innerJoin: () => CountQuery;
  where: (where: SQL) => Promise<readonly { readonly value: number }[]>;
};
function record(options: FindOptions): void {
  reads++;
  conditions.push(options.where);
  assert.equal(options.limit, undefined, "desktop source cannot silently retain preview cap");
  if (failSource) throw new Error("Fixture source unavailable");
}
mock.module("@backend/db", () => ({
  db: {
    query: {
      bankAccount: {
        findMany: async (options: FindOptions) => {
          record(options);
          return emptySource ? [] : [account, { ...account, id: archivedId, isActive: false }];
        },
      },
      bankStatementImport: {
        findMany: async (options: FindOptions) => {
          record(options);
          return [{ id: "fixture-import" }];
        },
      },
      cashTransaction: {
        findMany: async (options: FindOptions) => {
          record(options);
          return cashRows;
        },
      },
      bankStatementRow: {
        findMany: async (options: FindOptions) => {
          record(options);
          return options.with?.matchedCashTransaction ? historyRows : statementRows;
        },
      },
    },
    select: () => {
      const query: CountQuery = {
        from: (): CountQuery => query,
        innerJoin: (): CountQuery => query,
        where: async (where: SQL) => {
          conditions.push(where);
          return [{ value: emptySource ? 0 : historyRows.length }];
        },
      };
      return query;
    },
  },
}));
let currentActor: Actor | null = null;
mock.module("@backend/server/actor", () => ({
  resolveActor: async (): Promise<Actor | null> => currentActor,
}));
const { getReconciliationDesktopWorkspaceUseCase, getReconciliationMatchContextUseCase } =
  await import("./reconciliation-desktop");
const { requireReconciliationUser } =
  await import("@backend/app/actions/finance/reconciliation-action-utils");
const actor: Actor = {
  userId: "fixture",
  roleId: "custom",
  roleName: "CUSTOM_FINANCE",
  name: "Fixture",
  email: "fixture@example.test",
  isActive: true,
  mustChangePassword: false,
  sessionId: "fixture",
  permissions: ["reconcile:ledger"],
  dataScope: "GLOBAL",
  developerActorUserId: null,
};
for (const denied of [
  { ...actor, permissions: [] },
  { ...actor, dataScope: "ASSIGNED" as const },
  { ...actor, isActive: false },
]) {
  assert.equal(
    (await getReconciliationDesktopWorkspaceUseCase(denied, { view: "cash" })).success,
    false,
  );
  assert.equal(
    (await getReconciliationMatchContextUseCase(denied, { cashTransactionId: cashId(120) }))
      .success,
    false,
  );
}
assert.equal(reads, 0, "denied readers never touch finance source");
for (const input of [
  {},
  { cashTransactionId: "invalid" },
  { statementRowId: "invalid" },
  { cashTransactionId: cashId(120), statementRowId: statementId(120) },
]) {
  const invalid = await getReconciliationMatchContextUseCase(actor, input);
  assert.equal(invalid.success, false);
  if (invalid.success) throw new Error("Invalid context unexpectedly accepted");
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
}
const invalidAccount = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "statement",
  accountId: "invalid",
});
assert.equal(invalidAccount.success, false);
if (invalidAccount.success) throw new Error("Invalid account filter unexpectedly accepted");
assert.equal(invalidAccount.error.code, "VALIDATION_ERROR");
assert.equal(reads, 0, "malformed and multiple source IDs never touch finance source");
currentActor = { ...actor, dataScope: "ASSIGNED" };
assert.equal(
  (await requireReconciliationUser()).success,
  false,
  "legacy actions also reject assigned scope",
);
currentActor = actor;
assert.deepEqual(await requireReconciliationUser(), { success: true, data: { id: actor.userId } });

const legacyContext = await getReconciliationMatchContextUseCase(actor, {
  statementRowId: statementId(120),
});
assert.ok(legacyContext.success, "stored legacy statement UUID must reach the real context reader");
if (!legacyContext.success) throw new Error("Legacy UUID context unavailable");
assert.equal(legacyContext.data.cashTransactions[0]?.id, cashId(120));
assert.equal(legacyContext.data.statementRows[0]?.bankAccountId, accountId);

const cashPage = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "cash",
  sort: "amount",
  sortDirection: "descending",
  page: 11,
});
assert.ok(cashPage.success);
if (!cashPage.success || cashPage.data.view !== "cash") throw new Error("Cash page unavailable");
assert.equal(cashPage.data.total, 127);
assert.equal(cashPage.data.page, 11);
assert.equal(cashPage.data.rows.length, 10);
assert.equal(cashPage.data.rows[0]?.amount, 27.1, "global amount sort precedes slicing");
assert.equal(cashPage.data.counts.exceptions, 1);
assert.equal(cashPage.data.counts.actionRequired, 126);
assert.equal(
  cashPage.data.bankAccounts.length,
  1,
  "archived accounts do not enter manual input options",
);
const filtered = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "cash",
  status: "exception",
  direction: "OUTFLOW",
  page: 99,
});
assert.ok(filtered.success);
if (!filtered.success) throw new Error("Filter unavailable");
assert.equal(filtered.data.total, 1);
assert.equal(filtered.data.page, 1, "page is clamped after all filters");
const statementPage = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "statement",
  search: "Mutasi 120",
  accountId,
  status: "candidate",
});
assert.ok(statementPage.success);
if (!statementPage.success || statementPage.data.view !== "statement")
  throw new Error("Statement page unavailable");
assert.equal(statementPage.data.total, 1);
assert.equal(
  statementPage.data.rows[0]?.suggestedCashTransactionId,
  cashId(120),
  "legacy direction and cents match beyond the old 100-row preview",
);
const context = await getReconciliationMatchContextUseCase(actor, {
  statementRowId: statementId(120),
});
assert.ok(context.success);
if (!context.success) throw new Error("Context unavailable");
assert.equal(context.data.cashTransactions[0]?.id, cashId(120));
assert.equal(context.data.statementRows[0]?.id, statementId(120));
assert.equal(
  context.data.cashTransactions.length,
  1,
  "context only carries exact account/amount/direction candidates",
);
cashRows.push({ ...cashRows[120]!, id: cashId(500), bankReference: "" });
const ambiguous = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "statement",
  search: "Mutasi 120",
});
assert.ok(ambiguous.success);
if (!ambiguous.success || ambiguous.data.view !== "statement")
  throw new Error("Ambiguous source unavailable");
assert.equal(ambiguous.data.rows[0]?.candidateCount, 2);
assert.equal(
  ambiguous.data.rows[0]?.suggestedCashTransactionId,
  null,
  "ambiguous exact amounts never choose arbitrarily",
);
statementRows[120]!.description = "Mutasi 120 REF-120";
const referenced = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "statement",
  search: "Mutasi 120",
});
assert.ok(referenced.success);
if (!referenced.success || referenced.data.view !== "statement")
  throw new Error("Reference source unavailable");
assert.equal(
  referenced.data.rows[0]?.suggestedCashTransactionId,
  cashId(120),
  "existing unique bank reference disambiguates candidates",
);
const cashContext = await getReconciliationMatchContextUseCase(actor, {
  cashTransactionId: cashId(120),
});
assert.ok(cashContext.success);
if (!cashContext.success) throw new Error("Cash context unavailable");
assert.equal(cashContext.data.cashTransactions.length, 2);
assert.equal(cashContext.data.statementRows.length, 1);
cashRows.pop();
assert.equal(
  (await getReconciliationMatchContextUseCase(actor, { cashTransactionId: cashId(999) })).success,
  false,
);
const history = await getReconciliationDesktopWorkspaceUseCase(actor, {
  view: "history",
  page: 15,
  sort: "date",
  sortDirection: "descending",
});
assert.ok(history.success);
if (!history.success || history.data.view !== "history") throw new Error("History unavailable");
assert.equal(history.data.total, 151);
assert.equal(history.data.counts.history, 151);
assert.equal(
  history.data.rows[0]?.id,
  historyRows[140]?.id,
  "history sorts by reconciliation time, not import creation",
);
const dialect = new PgDialect();
for (const condition of conditions) {
  assert.ok(
    dialect.sqlToQuery(condition).params.includes(INSTANCE_TENANT_ID),
    "every source/aggregate is tenant fenced",
  );
}
failSource = true;
assert.equal(
  (await getReconciliationDesktopWorkspaceUseCase(actor, { view: "cash" })).success,
  false,
  "outage cannot look like empty healthy data",
);
failSource = false;
emptySource = true;
const empty = await getReconciliationDesktopWorkspaceUseCase(actor, { view: "statement" });
assert.ok(empty.success);
if (!empty.success) throw new Error("Empty failed");
assert.equal(empty.data.total, 0);
assert.deepEqual(empty.data.counts, {
  cash: 0,
  statement: 0,
  history: 0,
  exceptions: 0,
  actionRequired: 0,
});
console.log("desktop reconciliation complete paging and guarded context passed");
