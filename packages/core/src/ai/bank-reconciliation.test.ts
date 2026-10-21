import { expect, test } from "bun:test";
import {
  reconciliationInputSchema,
  reconciliationSaveSchema,
  statementMutationSchema,
  suggestedCashId,
  applyReconciliationReview,
  type ReconciliationProposal,
  type ReconciliationCandidate,
} from "./bank-reconciliation";
const id = "00000000-0000-0000-0000-000000000010",
  second = "00000000-0000-0000-0000-000000000011";
const mutation = {
  transactionDate: "2026-10-11",
  description: "Bayar INV-001",
  amount: 1500.25,
  type: "OUTFLOW" as const,
};
const candidate: ReconciliationCandidate = {
  id,
  description: "Bayar vendor",
  date: "2026-10-11",
  reference: "INV-001",
  amount: 1500.25,
  type: "OUTFLOW",
  exception: null,
};
test("bank import requires explicit account, calendar date, exact money and complete bounded rows", () => {
  const input = { action: "IMPORT", bankAccountId: id, fileName: "qa.csv", rows: [mutation] };
  expect(reconciliationInputSchema.safeParse(input).success).toBe(true);
  expect(reconciliationInputSchema.safeParse({ ...input, bankAccountId: undefined }).success).toBe(
    false,
  );
  expect(
    statementMutationSchema.safeParse({ ...mutation, transactionDate: "2026-02-30" }).success,
  ).toBe(false);
  expect(statementMutationSchema.safeParse({ ...mutation, amount: 0.001 }).success).toBe(false);
  expect(
    reconciliationInputSchema.safeParse({ ...input, rows: Array(500).fill(mutation) }).success,
  ).toBe(true);
  expect(
    reconciliationInputSchema.safeParse({ ...input, rows: Array(501).fill(mutation) }).success,
  ).toBe(false);
  expect(
    reconciliationSaveSchema.safeParse({
      conversationId: id,
      toolCallId: "qa",
      expectedRevision: 1,
      rows: [mutation],
    }).success,
  ).toBe(false);
});
test("exact references can suggest a pair but arbitrary ties, differing cents or direction cannot", () => {
  expect(suggestedCashId(mutation, [candidate])).toBe(id);
  expect(
    suggestedCashId(mutation, [candidate, { ...candidate, id: second, reference: null }]),
  ).toBe(id);
  expect(suggestedCashId(mutation, [candidate, { ...candidate, id: second }])).toBe(null);
  expect(
    suggestedCashId({ ...mutation, description: "Tanpa referensi" }, [
      candidate,
      { ...candidate, id: second },
    ]),
  ).toBe(null);
  expect(suggestedCashId(mutation, [{ ...candidate, amount: 1500.24 }])).toBe(null);
  expect(suggestedCashId(mutation, [{ ...candidate, type: "INFLOW" }])).toBe(null);
});
test("review cannot change stored statement facts, choose foreign candidates or reuse a cash pair", () => {
  const source: ReconciliationProposal = {
    kind: "BANK_RECONCILIATION_WORKFLOW",
    input: { action: "MATCH", bankAccountId: id, statementRowIds: [id, second] },
    title: "Cocokkan",
    bankAccountId: id,
    bankAccountName: "Bank QA",
    accountNumber: "123",
    expectedContext: "0".repeat(64),
    rows: [id, second].map((rowId) => ({
      rowId,
      statementRowId: rowId,
      mutation,
      fingerprint: "0".repeat(64),
      duplicate: false,
      selected: false,
      candidates: [candidate],
      chosenCashId: null,
    })),
    exception: null,
    warning: null,
    effect: "Saldo tetap",
  };
  const rows = source.rows.map((r) => ({
    rowId: r.rowId,
    mutation: r.mutation,
    selected: r.rowId === id,
    chosenCashId: id,
  }));
  const payload = { conversationId: id, toolCallId: "qa", rows };
  expect(applyReconciliationReview(source, payload).rows.filter((r) => r.selected).length).toBe(1);
  expect(() =>
    applyReconciliationReview(source, {
      ...payload,
      rows: rows.map((r) => ({ ...r, selected: true })),
    }),
  ).toThrow("sekali");
  expect(() =>
    applyReconciliationReview(source, {
      ...payload,
      rows: rows.map((r) => ({ ...r, chosenCashId: second })),
    }),
  ).toThrow("kandidat");
  expect(() =>
    applyReconciliationReview(source, {
      ...payload,
      rows: rows.map((r) => ({ ...r, mutation: { ...mutation, amount: 12 } })),
    }),
  ).toThrow("tidak dapat diubah");
});

test("whole queue matching is explicit and mutually exclusive with chosen statement IDs", () => {
  expect(
    reconciliationInputSchema.safeParse({ action: "MATCH", bankAccountId: id, allUnmatched: true })
      .success,
  ).toBe(true);
  expect(reconciliationInputSchema.safeParse({ action: "MATCH", bankAccountId: id }).success).toBe(
    false,
  );
  expect(
    reconciliationInputSchema.safeParse({
      action: "MATCH",
      bankAccountId: id,
      allUnmatched: true,
      statementRowIds: [id],
    }).success,
  ).toBe(false);
});
