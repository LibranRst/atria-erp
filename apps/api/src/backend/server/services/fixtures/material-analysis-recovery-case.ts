import { expect, mock } from "bun:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const mode = process.argv[2];
type Status = "QUEUED" | "PROCESSING" | "DONE" | "CANCELLED" | undefined;
let status: Status =
  mode === "future-queued" || mode === "cancelled"
    ? "QUEUED"
    : mode === "future-lease"
      ? "PROCESSING"
      : undefined;
let claimReads = 0,
  pendingReads = 0,
  writes = 0;
let pendingStarted: () => void = (): void => undefined;
const waitingForPending = new Promise<void>((resolve): void => {
  pendingStarted = resolve;
});
let releasePending: () => void = (): void => undefined;
const pendingBarrier = new Promise<void>((resolve): void => {
  releasePending = resolve;
});
const unexpectedWrite = (): never => {
  writes++;
  throw new Error("Recovery must not write finance, stock or material data.");
};
const transaction = {
  select: () => ({
    from: (_table: unknown) => ({
      where: (_condition: SQL | undefined) => ({
        for: (_lock: string, _options: unknown) => ({
          limit: async (_count: number): Promise<readonly never[]> => {
            claimReads++;
            return [];
          },
        }),
      }),
    }),
  }),
  update: unexpectedWrite,
  insert: unexpectedWrite,
  delete: unexpectedWrite,
};
mock.module("@backend/db", () => ({
  db: {
    transaction: async <T>(read: (tx: typeof transaction) => Promise<T>): Promise<T> =>
      read(transaction),
    insert: unexpectedWrite,
    update: unexpectedWrite,
    delete: unexpectedWrite,
    query: {
      materialImportAnalysisJob: {
        findFirst: async (options: { where?: SQL }): Promise<{ id: string } | undefined> => {
          pendingReads++;
          expect(options.where).toBeDefined();
          if (options.where) {
            const query = new PgDialect().sqlToQuery(options.where);
            expect(query.params).toEqual(["QUEUED", "PROCESSING"]);
            expect(query.sql).not.toContain("next_attempt_at");
            expect(query.sql).not.toContain("lease_expires_at");
          }
          const snapshot =
            status === "QUEUED" || status === "PROCESSING"
              ? { id: "future-pending-job" }
              : undefined;
          if (mode === "read-failure" && pendingReads === 1)
            throw new Error("Fixture pending read unavailable");
          if (mode === "snapshot-race" && pendingReads === 1) {
            pendingStarted();
            await pendingBarrier;
          }
          return snapshot;
        },
      },
    },
  },
}));
const worker = await import("../material-analysis-worker");
const recoveryState: unknown = Reflect.get(worker, "materialAnalysisRecoveryNeeded");
// Before the fix, the actual ticker always drains. Preserve that fallback so
// this test catches repeated SQL rather than merely requiring a new export.
const needsRecovery = (): boolean =>
  typeof recoveryState !== "function" || Reflect.apply(recoveryState, undefined, []) === true;
const tick = async (): Promise<void> => {
  if (needsRecovery()) await worker.drainMaterialAnalysis();
};
expect(needsRecovery()).toBe(true);
if (mode === "snapshot-race") {
  const first = worker.drainMaterialAnalysis();
  await waitingForPending;
  expect(needsRecovery()).toBe(false); // in flight: ticker does not create fake wakes
  status = "QUEUED";
  await worker.drainMaterialAnalysis(); // committed new enqueue while empty probe is in flight
  releasePending();
  await first;
  expect(needsRecovery()).toBe(true);
  await tick();
  expect(needsRecovery()).toBe(true);
  status = "DONE";
  await tick();
} else if (mode === "read-failure") {
  await expect(worker.drainMaterialAnalysis()).rejects.toThrow("Fixture pending read unavailable");
  expect(needsRecovery()).toBe(true);
  await tick();
} else {
  await worker.drainMaterialAnalysis();
  if (status) {
    expect(needsRecovery()).toBe(true);
    await tick();
    expect(needsRecovery()).toBe(true);
    status = mode === "cancelled" ? "CANCELLED" : "DONE";
    await tick();
  }
}
const completedReads = claimReads + pendingReads;
for (let minute = 0; minute < 20; minute++) await tick();
expect(claimReads + pendingReads).toBe(completedReads);
expect(needsRecovery()).toBe(false);
expect(writes).toBe(0);
if (mode === "empty") {
  expect(claimReads).toBe(1);
  expect(pendingReads).toBe(1);
}
console.log("material recovery fixture passed");
