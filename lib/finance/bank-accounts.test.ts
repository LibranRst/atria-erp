import { afterAll, describe, expect, it, mock } from "bun:test";
import { inArray } from "drizzle-orm";

import {
  createBankAccount,
  postManualCashMovement,
  setBankAccountActive,
  transferBetweenBankAccounts,
  updateBankAccount,
} from "@/app/actions/finance/bank-accounts";
import { db } from "@/db";
import { auditLog, bankAccount, cashTransaction } from "@/db/schema";
import { auth } from "@/lib/auth";

mock.module("next/headers", () => ({
  cookies: () => ({ toString: () => "mocked-cookies" }),
}));

mock.module("next/cache", () => ({
  revalidatePath: () => undefined,
}));

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

type MockUser = {
  readonly id: string;
  readonly roleId: string;
  readonly email: string;
  readonly name: string;
};

const OWNER_USER: MockUser = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

const FINANCE_USER: MockUser = {
  id: "22222222-2222-2222-2222-222222222222",
  roleId: "00000000-0000-0000-0000-000000000002",
  email: "lisa@dekoria.com",
  name: "Lisa Permata",
};

const PM_USER: MockUser = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

const createdAccountIds: string[] = [];

function mockUserSession(user: MockUser | null): void {
  const mockFn = async (): Promise<unknown> => {
    if (!user) return null;
    return {
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token: "mock-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: user.id,
        roleId: user.roleId,
        email: user.email,
        name: user.name,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  };
  (auth.api as unknown as { getSession: unknown }).getSession = mockFn;
}

function restoreUserSession(): void {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
}

function uniqueAccountNumber(label: string): string {
  return `TEST-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function createOwnedAccount(label: string, openingBalance: number): Promise<string> {
  mockUserSession(OWNER_USER);
  const result = await createBankAccount({
    name: `Test ${label}`,
    bankName: "BCA Test",
    accountNumber: uniqueAccountNumber(label),
    holderName: "PT Dekoria Test",
    openingBalance,
    cardColorFrom: "#0F2B5C",
    cardColorTo: "#1E40AF",
    cardTextColor: "light",
  });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error.message);
  createdAccountIds.push(result.data.id);
  return result.data.id;
}

describe("Bank account cash control actions", () => {
  afterAll(async () => {
    restoreUserSession();
    if (createdAccountIds.length === 0) return;
    await db
      .delete(cashTransaction)
      .where(inArray(cashTransaction.bankAccountId, createdAccountIds));
    await db.delete(auditLog).where(inArray(auditLog.targetId, createdAccountIds));
    await db.delete(bankAccount).where(inArray(bankAccount.id, createdAccountIds));
  });

  it("creates a bank account without changing balance when opening balance is zero", async () => {
    mockUserSession(OWNER_USER);
    const result = await createBankAccount({
      name: "Test Zero Opening",
      bankName: "BCA Test",
      accountNumber: uniqueAccountNumber("zero"),
      holderName: "PT Dekoria Test",
      openingBalance: 0,
      cardColorFrom: "#E0F2FE",
      cardColorTo: "#BAE6FD",
      cardTextColor: "dark",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    createdAccountIds.push(result.data.id);
    expect(result.data.balanceNumber).toBe(0);
    expect(result.data.cardTextColor).toBe("dark");
  });

  it("creates opening balance ledger and audit rows", async () => {
    const accountId = await createOwnedAccount("opening", 1250000);
    const account = await db.query.bankAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
    });
    const openingLedger = await db.query.cashTransaction.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.bankAccountId, accountId), eq(table.referenceType, "opening_balance")),
    });

    expect(Number(account?.balance ?? 0)).toBe(1250000);
    expect(openingLedger?.type).toBe("DEBIT");
    expect(Number(openingLedger?.amount ?? 0)).toBe(1250000);
  });

  it("updates metadata and card colors without changing balance", async () => {
    const accountId = await createOwnedAccount("update", 750000);
    mockUserSession(FINANCE_USER);
    const result = await updateBankAccount({
      bankAccountId: accountId,
      name: "Test Updated Account",
      bankName: "Mandiri Test",
      accountNumber: uniqueAccountNumber("updated"),
      holderName: "PT Updated",
      isActive: true,
      cardColorFrom: "#F5D7A1",
      cardColorTo: "#E8A95B",
      cardTextColor: "dark",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe("Test Updated Account");
    expect(result.data.balanceNumber).toBe(750000);
    expect(result.data.cardColorFrom).toBe("#F5D7A1");
  });

  it("posts manual debit and credit through the ledger", async () => {
    const accountId = await createOwnedAccount("manual", 1000000);
    mockUserSession(FINANCE_USER);

    const debit = await postManualCashMovement({
      bankAccountId: accountId,
      type: "DEBIT",
      amount: 250000,
      category: "owner_capital",
      description: "Tambahan modal test",
      transactionDate: new Date(),
      referenceNumber: "DEBIT-TEST",
    });
    expect(debit.success).toBe(true);

    const credit = await postManualCashMovement({
      bankAccountId: accountId,
      type: "CREDIT",
      amount: 100000,
      category: "bank_fee",
      description: "Biaya admin test",
      transactionDate: new Date(),
      referenceNumber: "CREDIT-TEST",
    });
    expect(credit.success).toBe(true);

    const account = await db.query.bankAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
    });
    expect(Number(account?.balance ?? 0)).toBe(1150000);
  });

  it("rejects manual credit when funds are insufficient", async () => {
    const accountId = await createOwnedAccount("insufficient", 50000);
    mockUserSession(FINANCE_USER);
    const result = await postManualCashMovement({
      bankAccountId: accountId,
      type: "CREDIT",
      amount: 75000,
      category: "bank_fee",
      description: "Biaya terlalu besar",
      transactionDate: new Date(),
      referenceNumber: "INSUFFICIENT-TEST",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("transfers balance between two active accounts atomically", async () => {
    const fromAccountId = await createOwnedAccount("transfer-from", 500000);
    const toAccountId = await createOwnedAccount("transfer-to", 100000);
    mockUserSession(FINANCE_USER);

    const result = await transferBetweenBankAccounts({
      fromBankAccountId: fromAccountId,
      toBankAccountId: toAccountId,
      amount: 175000,
      description: "Transfer antar rekening test",
      transactionDate: new Date(),
      referenceNumber: "TRF-TEST",
    });

    expect(result.success).toBe(true);
    const fromAccount = await db.query.bankAccount.findFirst({
      where: (table, { eq }) => eq(table.id, fromAccountId),
    });
    const toAccount = await db.query.bankAccount.findFirst({
      where: (table, { eq }) => eq(table.id, toAccountId),
    });
    expect(Number(fromAccount?.balance ?? 0)).toBe(325000);
    expect(Number(toAccount?.balance ?? 0)).toBe(275000);
  });

  it("archives accounts only for Owner and rejects PM access", async () => {
    const accountId = await createOwnedAccount("archive", 0);

    mockUserSession(FINANCE_USER);
    const financeArchive = await setBankAccountActive({
      bankAccountId: accountId,
      isActive: false,
    });
    expect(financeArchive.success).toBe(false);
    if (!financeArchive.success) expect(financeArchive.error.code).toBe("FORBIDDEN");

    mockUserSession(OWNER_USER);
    const ownerArchive = await setBankAccountActive({ bankAccountId: accountId, isActive: false });
    expect(ownerArchive.success).toBe(true);
    if (ownerArchive.success) expect(ownerArchive.data.isActive).toBe(false);

    mockUserSession(PM_USER);
    const pmCreate = await createBankAccount({
      name: "PM Forbidden",
      bankName: "BCA",
      accountNumber: uniqueAccountNumber("pm"),
      holderName: "PM",
      openingBalance: 0,
      cardColorFrom: "#0F2B5C",
      cardColorTo: "#1E40AF",
      cardTextColor: "light",
    });
    expect(pmCreate.success).toBe(false);
    if (!pmCreate.success) expect(pmCreate.error.code).toBe("FORBIDDEN");
  });
});
