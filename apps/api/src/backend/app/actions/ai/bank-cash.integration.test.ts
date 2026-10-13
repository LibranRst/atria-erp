import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  tenant,
  INSTANCE_TENANT_ID,
  role,
  rolePermission,
  user,
  bankAccount,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  cashTransaction,
  auditLog,
  stockMovement,
  projectCost,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { prepareBankCashProposal } from "@backend/server/usecases/ai/bank-cash-context";
import * as balance from "@backend/lib/finance/balance-mutation";
import {
  transferBetweenBankAccounts,
  postManualCashMovement,
} from "@backend/app/actions/finance/bank-account-movements";
import {
  updateBankAccount,
  createBankAccount,
} from "@backend/app/actions/finance/bank-account-management";
import { confirmAiBankCashProposal, getAiBankCashProposal } from "./bank-cash";
import { bankCashInputSchema, type BankCashInput } from "@atria/core/ai/bank-cash";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `BC-${randomUUID().slice(0, 8)}`;
const grants: PermissionKey[] = [
  "use:ai_chat",
  "view:bank_account",
  "create:bank_account",
  "update:bank_account",
  "delete:bank_account",
  "create:ledger",
];
type Person = typeof user.$inferSelect;
let owner: Person, other: Person, none: Person, a: string, b: string;
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
async function person(scope: RoleDataScope): Promise<Person> {
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
async function proof(
  raw: unknown,
): Promise<{ identity: { conversationId: string; toolCallId: string }; messageId: string }> {
  const proposal = await prepareBankCashProposal(await actor(), raw);
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
        {
          type: "tool-proposeBankCash",
          toolCallId,
          state: "output-available",
          output: { proposal },
        },
      ],
    })
    .returning();
  return { identity: { conversationId: c.id, toolCallId }, messageId: m.id };
}
const save = withTestRequest(confirmAiBankCashProposal),
  read = withTestRequest(getAiBankCashProposal),
  manualTransfer = withTestRequest(transferBetweenBankAccounts),
  manualCash = withTestRequest(postManualCashMovement),
  manualEdit = withTestRequest(updateBankAccount),
  manualCreate = withTestRequest(createBankAccount);
function cash(reference = randomUUID(), amount = 15): BankCashInput {
  return bankCashInputSchema.parse({
    action: "CASH_MOVEMENT",
    bankAccountId: a,
    type: "OUTFLOW",
    amount,
    category: "bank_fee",
    description: "Biaya bank untuk pengujian",
    transactionDate: "2026-10-11",
    referenceNumber: reference,
  });
}
function transfer(from = a, to = b, reference = randomUUID()): BankCashInput {
  return bankCashInputSchema.parse({
    action: "TRANSFER",
    fromBankAccountId: from,
    toBankAccountId: to,
    amount: 100,
    description: "Pindah saldo untuk pengujian",
    transactionDate: "2026-10-11",
    referenceNumber: reference,
  });
}
async function balances(): Promise<number[]> {
  const rows = await db.query.bankAccount.findMany({ where: inArray(bankAccount.id, [a, b]) });
  return [a, b].map((id) => Number(rows.find((r) => r.id === id)?.balance));
}
async function totals(): Promise<number[]> {
  return Promise.all(
    [cashTransaction, aiProposalConfirmation, auditLog, stockMovement, projectCost].map(async (t) =>
      Number((await db.select({ n: count() }).from(t))[0].n),
    ),
  );
}

describeIntegration("AI bank account and cash actions", () => {
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
    const rows = await db
      .insert(bankAccount)
      .values(
        ["Sumber", "Tujuan"].map((name) => ({
          name: prefix + name,
          accountNumber: randomUUID(),
          bankName: "Bank QA",
          holderName: prefix,
          balance: "1000.00",
          cardColorFrom: "#123456",
          cardColorTo: "#654321",
          cardTextColor: "dark",
        })),
      )
      .returning();
    a = rows[0].id;
    b = rows[1].id;
  });
  afterAll(() => Reflect.set(auth.api, "getSession", original));
  test("creates zero/opening accounts with ledger, audit, reference and idempotent receipt", async () => {
    const baseline = await totals();
    const zero = await proof({
      action: "CREATE_ACCOUNT",
      payload: {
        name: prefix + "Nol",
        accountNumber: randomUUID(),
        bankName: "Bank QA",
        holderName: prefix,
      },
    });
    const z = ok(await save(zero.identity));
    expect(
      (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, z.resultId) }))?.balance,
    ).toBe("0.00");
    expect((await totals())[0]).toBe(baseline[0]);
    const ref = randomUUID(),
      positive = await proof({
        action: "CREATE_ACCOUNT",
        openingDate: "2026-10-11",
        payload: {
          name: prefix + "Awal",
          accountNumber: randomUUID(),
          bankName: "Bank QA",
          holderName: prefix,
          openingBalance: 125.25,
          openingReference: ref,
          openingNote: "Saldo awal dari catatan pemilik",
        },
      });
    const p = ok(await save(positive.identity));
    expect(
      (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, p.resultId) }))?.balance,
    ).toBe("125.25");
    const ledger = await db.query.cashTransaction.findFirst({
      where: eq(cashTransaction.bankAccountId, p.resultId),
    });
    expect(ledger?.bankReference).toBe(ref);
    expect(ledger?.referenceType).toBe("opening_balance");
    expect(ledger?.reconciled).toBe(false);
    expect(ok(await save(positive.identity))).toEqual({ ...p, alreadyConfirmed: true });
    expect((await totals())[0]).toBe(baseline[0] + 1);
  });
  test("metadata preserves balance/theme and status prevents new cash entries", async () => {
    const p = await proof({
      action: "EDIT_ACCOUNT",
      bankAccountId: a,
      patch: { name: prefix + "Nama baru" },
    });
    ok(await save(p.identity));
    let row = await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, a) });
    expect(row?.balance).toBe("1000.00");
    expect(row?.cardColorFrom).toBe("#123456");
    expect(row?.cardTextColor).toBe("dark");
    const s = await proof({ action: "ACCOUNT_STATUS", bankAccountId: a, isActive: false });
    ok(await save(s.identity));
    expect((await balances())[0]).toBe(1000);
    await expect(prepareBankCashProposal(await actor(), cash())).rejects.toThrow("nonaktif");
    const active = await proof({ action: "ACCOUNT_STATUS", bankAccountId: a, isActive: true });
    ok(await save(active.identity));
    row = await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, a) });
    expect(row?.isActive).toBe(true);
  });
  test("custom NONE bank grants follow the bank domain; current DB revocation blocks save", async () => {
    as(none);
    const p = await proof(cash());
    ok(await save(p.identity));
    expect((await balances())[0]).toBe(985);
    as(owner);
    const q = await proof(cash());
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId!),
          eq(rolePermission.permissionKey, "create:ledger"),
        ),
      );
    try {
      const r = await save(q.identity);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe("FORBIDDEN");
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId!, permissionKey: "create:ledger" });
    }
  });
  test("ownership, malformed payloads and foreign tenant references cannot write", async () => {
    const p = await proof(cash());
    as(other);
    expect((await save(p.identity)).success).toBe(false);
    as(owner);
    expect((await save({ ...p.identity, payload: cash(), userId: other.id })).success).toBe(false);
    const [t] = await db.insert(tenant).values({ name: prefix, slug: randomUUID() }).returning();
    const [foreign] = await db
      .insert(bankAccount)
      .values({
        tenantId: t.id,
        name: prefix,
        accountNumber: randomUUID(),
        bankName: "Bank QA",
        holderName: prefix,
        balance: "1000.00",
      })
      .returning();
    await expect(
      prepareBankCashProposal(await actor(), {
        action: "ACCOUNT_STATUS",
        bankAccountId: foreign.id,
        isActive: false,
      }),
    ).rejects.toThrow("di luar akses");
    expect(await balances()).toEqual([1000, 1000]);
  });
  test("manual balance edits stale the snapshot, and fresh duplicate references are rejected", async () => {
    const ref = randomUUID(),
      p = await proof(cash(ref));
    ok(
      await manualCash({
        bankAccountId: a,
        type: "OUTFLOW",
        amount: 5,
        category: "bank_fee",
        description: "Mutasi manual bersamaan",
        transactionDate: new Date(),
        referenceNumber: ref,
      }),
    );
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    expect((await balances())[0]).toBe(995);
    await expect(prepareBankCashProposal(await actor(), cash(ref))).rejects.toThrow(
      "DUPLICATE_BANK_REFERENCE",
    );
  });
  test("cash double-click/retry writes one unreconciled entry and leaves stock/project costs unchanged", async () => {
    const before = await totals(),
      p = await proof(cash());
    const results = await Promise.all([save(p.identity), save(p.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(ok(results[0]).resultId).toBe(ok(results[1]).resultId);
    expect((await balances())[0]).toBe(985);
    const after = await totals();
    expect(after[0] - before[0]).toBe(1);
    expect(after[1] - before[1]).toBe(1);
    expect(after.slice(3)).toEqual(before.slice(3));
    expect(ok(await read(p.identity)).status).toBe("CONFIRMED");
  });
  test("manual inflow and an inactive transfer destination preserve exact balances", async () => {
    const input = bankCashInputSchema.parse({
      action: "CASH_MOVEMENT",
      bankAccountId: a,
      type: "INFLOW",
      amount: 12.5,
      category: "owner_capital",
      description: "Modal pemilik untuk uji",
      transactionDate: "2026-10-11",
      referenceNumber: randomUUID(),
    });
    const p = await proof(input);
    ok(await save(p.identity));
    expect(await balances()).toEqual([1012.5, 1000]);
    const inactive = await proof({ action: "ACCOUNT_STATUS", bankAccountId: b, isActive: false });
    ok(await save(inactive.identity));
    await expect(prepareBankCashProposal(await actor(), transfer())).rejects.toThrow("nonaktif");
    const r = await manualTransfer({
      fromBankAccountId: a,
      toBankAccountId: b,
      amount: 20,
      description: "Transfer ke rekening nonaktif",
      transactionDate: new Date(),
      referenceNumber: randomUUID(),
    });
    expect(r.success).toBe(false);
    expect(await balances()).toEqual([1012.5, 1000]);
  });
  test("transfer commits both linked sides and conserves total cash", async () => {
    const p = await proof(transfer()),
      r = ok(await save(p.identity));
    expect(await balances()).toEqual([900, 1100]);
    const rows = await db.query.cashTransaction.findMany({
      where: and(
        eq(cashTransaction.referenceType, "bank_transfer"),
        eq(cashTransaction.referenceId, r.resultId),
      ),
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.type).sort()).toEqual(["INFLOW", "OUTFLOW"]);
    expect(rows.every((r) => !r.reconciled && r.bankReference)).toBe(true);
  });
  test("opposite manual transfers lock deterministically; overlapping AI previews stale safely", async () => {
    await Promise.all([
      manualTransfer({
        fromBankAccountId: a,
        toBankAccountId: b,
        amount: 20,
        description: "Transfer manual arah satu",
        transactionDate: new Date(),
        referenceNumber: randomUUID(),
      }),
      manualTransfer({
        fromBankAccountId: b,
        toBankAccountId: a,
        amount: 10,
        description: "Transfer manual arah dua",
        transactionDate: new Date(),
        referenceNumber: randomUUID(),
      }),
    ]).then((rs) => rs.forEach(ok));
    expect(await balances()).toEqual([990, 1010]);
    const one = await proof(transfer()),
      two = await proof(transfer(b, a));
    const rs = await Promise.all([save(one.identity), save(two.identity)]);
    expect(rs.filter((r) => r.success)).toHaveLength(1);
    expect((await balances()).reduce((x, y) => x + y, 0)).toBe(2000);
  });
  test("failure on second ledger side rolls back balances, ledger, audits and receipt", async () => {
    const p = await proof(transfer()),
      before = await totals(),
      originalMutation = balance.mutateBalance;
    let calls = 0;
    const spy = spyOn(balance, "mutateBalance").mockImplementation(async (args) => {
      if (++calls === 2) throw new Error("forced fixture rollback");
      return originalMutation(args);
    });
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      spy.mockRestore();
    }
    expect(await balances()).toEqual([1000, 1000]);
    expect(await totals()).toEqual(before);
  });
  test("expired proof and insufficient funds do not post cash", async () => {
    const p = await proof(cash());
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p.messageId));
    expect(ok(await read(p.identity)).status).toBe("EXPIRED");
    expect((await save(p.identity)).success).toBe(false);
    await expect(prepareBankCashProposal(await actor(), cash(randomUUID(), 1001))).rejects.toThrow(
      "tidak mencukupi",
    );
    expect(await balances()).toEqual([1000, 1000]);
  });
  test("manual account identity changes require status permission and serialize with AI creation", async () => {
    const number = randomUUID(),
      p = await proof({
        action: "CREATE_ACCOUNT",
        payload: { name: prefix, accountNumber: number, bankName: "Bank QA", holderName: prefix },
      });
    ok(
      await manualCreate({
        name: prefix,
        accountNumber: number,
        bankName: "Bank QA",
        holderName: prefix,
      }),
    );
    expect((await save(p.identity)).success).toBe(false);
    const rows = await db.query.bankAccount.findMany({
      where: eq(bankAccount.accountNumber, number),
    });
    expect(rows).toHaveLength(1);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId!),
          eq(rolePermission.permissionKey, "delete:bank_account"),
        ),
      );
    try {
      const row = await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, a) });
      if (!row) throw new Error("missing bank");
      expect(
        (
          await manualEdit({
            bankAccountId: a,
            name: row.name,
            bankName: row.bankName,
            accountNumber: row.accountNumber,
            holderName: row.holderName,
            isActive: false,
          })
        ).success,
      ).toBe(false);
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId!, permissionKey: "delete:bank_account" });
    }
  });
});
