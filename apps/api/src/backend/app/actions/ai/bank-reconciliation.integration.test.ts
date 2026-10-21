import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  tenant,
  INSTANCE_TENANT_ID,
  role,
  rolePermission,
  user,
  bankAccount,
  bankStatementRow,
  bankStatementImport,
  cashTransaction,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  stockMovement,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { prepareReconciliationProposal } from "@backend/server/usecases/ai/reconciliation-context";
import * as writer from "@backend/server/usecases/finance/reconciliation-writer";
import {
  getAiReconciliationProposal,
  patchAiReconciliationProposal,
  confirmAiReconciliationProposal,
  discardAiReconciliationProposal,
} from "./bank-reconciliation";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  ReconciliationInput,
  ReconciliationProposal,
} from "@atria/core/ai/bank-reconciliation";
const prefix = `RC-${randomUUID().slice(0, 8)}`,
  grants = ["use:ai_chat", "reconcile:ledger", "view:bank_account"];
type Person = typeof user.$inferSelect;
let owner: Person, other: Person, none: Person, accountId: string;
const original = Reflect.get(auth.api, "getSession");
function as(p: Person): void {
  Reflect.set(auth.api, "getSession", async () => ({
    user: p,
    session: { id: randomUUID(), userId: p.id, expiresAt: new Date(Date.now() + 3600000) },
  }));
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("Actor missing");
  return a;
}
async function person(scope: "GLOBAL" | "NONE"): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: prefix + randomUUID(), dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(grants.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  return (
    await db
      .insert(user)
      .values({
        name: r.name,
        email: randomUUID() + "@fixture.invalid",
        roleId: r.id,
        isActive: true,
        mustChangePassword: false,
      })
      .returning()
  )[0];
}
const read = withTestRequest(getAiReconciliationProposal),
  patch = withTestRequest(patchAiReconciliationProposal),
  save = withTestRequest(confirmAiReconciliationProposal),
  discard = withTestRequest(discardAiReconciliationProposal);
const mutation = (
  description = "Mutasi pengujian",
  amount = 100,
): { transactionDate: string; description: string; amount: number; type: "OUTFLOW" } => ({
  transactionDate: "2026-10-11",
  description,
  amount,
  type: "OUTFLOW",
});
async function proof(
  input: ReconciliationInput,
  toolName = "proposeBankReconciliation",
): Promise<{
  identity: { conversationId: string; toolCallId: string };
  proposal: ReconciliationProposal;
  messageId: string;
}> {
  const proposal = await prepareReconciliationProposal(await actor(), input);
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: (await actor()).userId, title: prefix })
    .returning();
  const toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        { type: `tool-${toolName}`, toolCallId, state: "output-available", output: { proposal } },
      ],
    })
    .returning();
  return { identity: { conversationId: c.id, toolCallId }, proposal, messageId: m.id };
}
async function statement(description = "Mutasi pengujian", amount = 100): Promise<string> {
  return (
    await db.transaction((tx) =>
      writer.importStatementRowsTx(tx, owner.id, {
        bankAccountId: accountId,
        fileName: "qa.csv",
        rows: [{ ...mutation(description, amount), transactionDate: new Date("2026-10-11") }],
      }),
    )
  ).rowIds[0]!;
}
async function cash(
  description = "Catatan kas QA",
  amount = 100,
  reference: string | null = null,
): Promise<string> {
  return (
    await db
      .insert(cashTransaction)
      .values({
        bankAccountId: accountId,
        type: "OUTFLOW",
        amount: amount.toFixed(2),
        description,
        category: "other",
        bankReference: reference,
      })
      .returning()
  )[0].id;
}
async function totals(): Promise<number[]> {
  return Promise.all(
    [
      cashTransaction,
      stockMovement,
      bankStatementRow,
      bankStatementImport,
      aiProposalConfirmation,
      auditLog,
    ].map(async (t) => Number((await db.select({ n: count() }).from(t))[0].n)),
  );
}
describeIntegration("Owned AI bank reconciliation workflow", () => {
  beforeAll(async () => {
    await db
      .insert(tenant)
      .values({ id: INSTANCE_TENANT_ID, name: prefix, slug: prefix.toLowerCase() })
      .onConflictDoNothing();
    owner = await person("GLOBAL");
    other = await person("GLOBAL");
    none = await person("NONE");
  });
  beforeEach(async () => {
    as(owner);
    await db
      .insert(rolePermission)
      .values(grants.map((permissionKey) => ({ roleId: owner.roleId!, permissionKey })))
      .onConflictDoNothing();
    accountId = (
      await db
        .insert(bankAccount)
        .values({
          name: prefix,
          bankName: "Bank QA",
          accountNumber: randomUUID(),
          holderName: prefix,
          balance: "1000.00",
        })
        .returning()
    )[0].id;
  });
  afterAll(() => Reflect.set(auth.api, "getSession", original));
  test("attachment-derived import is owned, subset persisted, receipt replayed and no cash/stock created", async () => {
    const p = await proof(
      {
        action: "IMPORT",
        bankAccountId: accountId,
        fileName: "qa.csv",
        rows: [mutation("Baris satu"), mutation("Baris dua", 120)],
      },
      "analyzeBankStatementAttachment",
    );
    const v = ok(await read(p.identity));
    const edited = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        rows: v.proposal.rows.map((r, i) => ({
          rowId: r.rowId,
          selected: i === 0,
          mutation: r.mutation,
          chosenCashId: null,
        })),
      }),
    );
    const before = await totals();
    const r = ok(await save({ ...p.identity, expectedRevision: edited.revision }));
    expect(r.alreadyConfirmed).toBe(false);
    expect(
      ok(await save({ ...p.identity, expectedRevision: edited.revision })).alreadyConfirmed,
    ).toBe(true);
    const after = await totals();
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[2] - before[2]).toBe(1);
    expect(after[4] - before[4]).toBe(1);
    expect(
      (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, accountId) }))?.balance,
    ).toBe("1000.00");
    expect(ok(await read(p.identity)).status).toBe("CONFIRMED");
  });
  test("ambiguous candidates stay unselected, explicit pair choice is persisted and audited", async () => {
    const s = await statement(),
      a = await cash("Satu"),
      b = await cash("Dua");
    const p = await proof({ action: "MATCH", bankAccountId: accountId, statementRowIds: [s] });
    const v = ok(await read(p.identity));
    expect(v.proposal.rows[0].selected).toBe(false);
    expect(v.proposal.rows[0].candidates).toHaveLength(2);
    expect((await save({ ...p.identity, expectedRevision: v.revision })).success).toBe(false);
    const next = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        rows: [
          { rowId: s, mutation: v.proposal.rows[0].mutation, selected: true, chosenCashId: b },
        ],
      }),
    );
    expect(ok(await read(p.identity)).proposal.rows[0].chosenCashId).toBe(b);
    const before = await totals();
    ok(await save({ ...p.identity, expectedRevision: next.revision }));
    expect(
      (await db.query.bankStatementRow.findFirst({ where: eq(bankStatementRow.id, s) }))
        ?.matchedCashTransactionId,
    ).toBe(b);
    expect(
      (await db.query.cashTransaction.findFirst({ where: eq(cashTransaction.id, a) }))?.reconciled,
    ).toBe(false);
    expect((await totals())[0]).toBe(before[0]);
  });
  test("a match cannot reuse one cash record or choose a foreign candidate", async () => {
    const s1 = await statement("Mutasi satu"),
      s2 = await statement("Mutasi dua"),
      c = await cash();
    const p = await proof({ action: "MATCH", bankAccountId: accountId, statementRowIds: [s1, s2] });
    const v = ok(await read(p.identity));
    expect(
      (
        await patch({
          ...p.identity,
          expectedRevision: v.revision,
          rows: v.proposal.rows.map((r) => ({
            rowId: r.rowId,
            mutation: r.mutation,
            selected: true,
            chosenCashId: c,
          })),
        })
      ).success,
    ).toBe(false);
    expect(
      (
        await patch({
          ...p.identity,
          expectedRevision: v.revision,
          rows: v.proposal.rows.map((r) => ({
            rowId: r.rowId,
            mutation: r.mutation,
            selected: true,
            chosenCashId: randomUUID(),
          })),
        })
      ).success,
    ).toBe(false);
  });
  test("mark/clear exceptions retain unreconciled cash, require a reason and exact snapshot", async () => {
    const c = await cash();
    const mark = await proof({
      action: "MARK_EXCEPTION",
      bankAccountId: accountId,
      cashTransactionId: c,
      reason: "Belum muncul pada mutasi bank",
    });
    const v = ok(await read(mark.identity));
    ok(await save({ ...mark.identity, expectedRevision: v.revision }));
    expect(
      (await db.query.cashTransaction.findFirst({ where: eq(cashTransaction.id, c) }))?.reconciled,
    ).toBe(false);
    const clear = await proof({
      action: "CLEAR_EXCEPTION",
      bankAccountId: accountId,
      cashTransactionId: c,
    });
    ok(
      await save({ ...clear.identity, expectedRevision: ok(await read(clear.identity)).revision }),
    );
    expect(
      (await db.query.cashTransaction.findFirst({ where: eq(cashTransaction.id, c) }))
        ?.reconciliationExceptionReason,
    ).toBe(null);
  });
  test("permission revocation and foreign ownership cannot read or save stored values", async () => {
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation()],
    });
    const v = ok(await read(p.identity));
    as(other);
    expect((await read(p.identity)).success).toBe(false);
    expect((await save({ ...p.identity, expectedRevision: v.revision })).success).toBe(false);
    as(owner);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId!),
          eq(rolePermission.permissionKey, "reconcile:ledger"),
        ),
      );
    expect((await read(p.identity)).success).toBe(false);
    expect((await save({ ...p.identity, expectedRevision: v.revision })).success).toBe(false);
  });
  test("custom NONE bank grant follows existing domain permission without role-name authority", async () => {
    as(none);
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation()],
    });
    ok(await save({ ...p.identity, expectedRevision: ok(await read(p.identity)).revision }));
  });
  test("duplicate source is marked and edited duplicate subset rolls back atomically", async () => {
    await statement();
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation(), mutation("Baris kedua", 120)],
    });
    const v = ok(await read(p.identity));
    expect(v.proposal.rows[0].duplicate).toBe(true);
    const next = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        rows: v.proposal.rows.map((r, i) => ({
          rowId: r.rowId,
          selected: i === 1,
          mutation: i === 1 ? mutation() : r.mutation,
          chosenCashId: null,
        })),
      }),
    );
    const before = await totals();
    expect((await save({ ...p.identity, expectedRevision: next.revision })).success).toBe(false);
    expect(await totals()).toEqual(before);
  });
  test("manual reconciliation makes prior AI proof stale and cannot match again", async () => {
    const s = await statement(),
      c = await cash();
    const p = await proof({ action: "MATCH", bankAccountId: accountId, statementRowIds: [s] });
    const v = ok(await read(p.identity));
    await db.transaction((tx) =>
      writer.reconcilePairTx(tx, owner.id, { cashTransactionId: c, bankStatementRowId: s }),
    );
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save({ ...p.identity, expectedRevision: v.revision })).success).toBe(false);
  });
  test("revision conflict, discard, expiry and changed/inactive account block writes", async () => {
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation()],
    });
    const v = ok(await read(p.identity));
    ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        rows: v.proposal.rows.map((r) => ({
          rowId: r.rowId,
          selected: true,
          mutation: r.mutation,
          chosenCashId: null,
        })),
      }),
    );
    expect((await save({ ...p.identity, expectedRevision: v.revision })).success).toBe(false);
    ok(await discard(p.identity));
    expect((await save({ ...p.identity, expectedRevision: v.revision + 1 })).success).toBe(false);
    const exp = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation("Exp")],
    });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, exp.messageId));
    expect(ok(await read(exp.identity)).status).toBe("EXPIRED");
    const inactive = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation("Inactive")],
    });
    const iv = ok(await read(inactive.identity));
    await db.update(bankAccount).set({ isActive: false }).where(eq(bankAccount.id, accountId));
    expect((await save({ ...inactive.identity, expectedRevision: iv.revision })).success).toBe(
      false,
    );
  });
  test("double-click is one receipt; failure on second match rolls back the whole subset", async () => {
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      rows: [mutation()],
    });
    const v = ok(await read(p.identity));
    const results = await Promise.all([
      save({ ...p.identity, expectedRevision: v.revision }),
      save({ ...p.identity, expectedRevision: v.revision }),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(2);
    expect(results.map(ok).filter((r) => !r.alreadyConfirmed)).toHaveLength(1);
    const s1 = await statement("Match one", 200),
      s2 = await statement("Match two", 300);
    await cash("Cash one", 200);
    await cash("Cash two", 300);
    const m = await proof({ action: "MATCH", bankAccountId: accountId, statementRowIds: [s1, s2] });
    const mv = ok(await read(m.identity));
    const before = await totals();
    const original = writer.reconcilePairTx;
    let calls = 0;
    const intercept = spyOn(writer, "reconcilePairTx").mockImplementation(async (...args) => {
      calls++;
      if (calls === 2) throw new Error("fixture rollback");
      return original(...args);
    });
    try {
      expect((await save({ ...m.identity, expectedRevision: mv.revision })).success).toBe(false);
      expect(await totals()).toEqual(before);
      expect(
        (await db.query.bankStatementRow.findFirst({ where: eq(bankStatementRow.id, s1) }))
          ?.isReconciled,
      ).toBe(false);
    } finally {
      intercept.mockRestore();
    }
  });
  test("source account mismatch and client-supplied business payload cannot save", async () => {
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "qa.csv",
      detectedAccountNumber: "WRONG",
      rows: [mutation()],
    });
    const v = ok(await read(p.identity));
    expect(v.proposal.warning).toContain("berbeda");
    expect((await save({ ...p.identity, expectedRevision: v.revision })).success).toBe(false);
    expect((await save({ ...p.identity, expectedRevision: v.revision, rows: [] })).success).toBe(
      false,
    );
  });
  test("foreign tenant accounts cannot be prepared or matched through the shared writer", async () => {
    const [foreignTenant] = await db
      .insert(tenant)
      .values({ name: "Tenant QA asing", slug: randomUUID() })
      .returning();
    const [foreignBank] = await db
      .insert(bankAccount)
      .values({
        tenantId: foreignTenant.id,
        name: "Rekening asing",
        bankName: "Bank QA",
        accountNumber: randomUUID(),
        holderName: "QA",
      })
      .returning();
    await expect(
      prepareReconciliationProposal(await actor(), {
        action: "IMPORT",
        bankAccountId: foreignBank.id,
        fileName: "qa.csv",
        rows: [mutation()],
      }),
    ).rejects.toThrow("di luar akses");
    const [foreignCash] = await db
      .insert(cashTransaction)
      .values({
        tenantId: foreignTenant.id,
        bankAccountId: foreignBank.id,
        type: "OUTFLOW",
        amount: "100.00",
        description: "Catatan asing",
        category: "other",
      })
      .returning();
    const s = await statement();
    await expect(
      db.transaction((tx) =>
        writer.reconcilePairTx(tx, owner.id, {
          cashTransactionId: foreignCash.id,
          bankStatementRowId: s,
        }),
      ),
    ).rejects.toThrow("tidak ditemukan");
  });
  test("exactly 500 complete source rows import atomically without cash or stock changes", async () => {
    const p = await proof({
      action: "IMPORT",
      bankAccountId: accountId,
      fileName: "500.csv",
      rows: Array.from({ length: 500 }, (_, i) => mutation(`Baris QA ${i + 1}`)),
    });
    const v = ok(await read(p.identity)),
      before = await totals();
    ok(await save({ ...p.identity, expectedRevision: v.revision }));
    const after = await totals();
    expect(after[2] - before[2]).toBe(500);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });
  test("whole account queue is prepared in one proof without model-side ID copying", async () => {
    await statement("Antrean pertama", 200);
    await statement("Antrean kedua", 300);
    await cash("Kas pertama", 200);
    await cash("Kas kedua", 300);
    const p = await proof({ action: "MATCH", bankAccountId: accountId, allUnmatched: true });
    const v = ok(await read(p.identity));
    expect(v.proposal.rows).toHaveLength(2);
    expect(v.proposal.rows.every((r) => r.selected)).toBe(true);
    ok(await save({ ...p.identity, expectedRevision: v.revision }));
  });
});
