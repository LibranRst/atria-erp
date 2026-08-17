import { afterAll, describe, expect, it, mock } from "bun:test";
import { eq, inArray } from "drizzle-orm";

import {
  createBankAccount,
  postManualCashMovement,
  setBankAccountActive,
  transferBetweenBankAccounts,
  updateBankAccount,
} from "@/app/actions/finance/bank-accounts";
import {
  clearReconciliationException,
  markReconciliationException,
  reconcileCashTransaction,
} from "@/app/actions/finance/reconcile-cash-transaction";
import {
  getReconciliationWorkspace,
  importBankStatementCsv,
  recordBankStatementRow,
} from "@/app/actions/finance/reconciliation-workspace";
import { getProjectClosingChecklist } from "@/app/actions/project/closing";
import { db } from "@/db";
import {
  auditLog,
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  projectCost,
} from "@/db/schema";
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
    const imports = await db
      .select({ id: bankStatementImport.id })
      .from(bankStatementImport)
      .where(inArray(bankStatementImport.bankAccountId, createdAccountIds));
    if (imports.length > 0) {
      await db.delete(bankStatementRow).where(
        inArray(
          bankStatementRow.importId,
          imports.map((item) => item.id),
        ),
      );
      await db.delete(bankStatementImport).where(
        inArray(
          bankStatementImport.id,
          imports.map((item) => item.id),
        ),
      );
    }
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
    expect(openingLedger?.type).toBe("INFLOW");
    expect(Number(openingLedger?.amount ?? 0)).toBe(1250000);
    expect(openingLedger?.reconciled).toBe(false);
    expect(openingLedger?.reconciliationDate).toBeNull();
    expect(openingLedger?.reconciledById).toBeNull();
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

  it("posts manual inflow and outflow through the ledger", async () => {
    const accountId = await createOwnedAccount("manual", 1000000);
    mockUserSession(FINANCE_USER);

    const inflow = await postManualCashMovement({
      bankAccountId: accountId,
      type: "INFLOW",
      amount: 250000,
      category: "owner_capital",
      description: "Tambahan modal test",
      transactionDate: new Date(),
      referenceNumber: "INFLOW-TEST",
    });
    expect(inflow.success).toBe(true);

    const outflow = await postManualCashMovement({
      bankAccountId: accountId,
      type: "OUTFLOW",
      amount: 100000,
      category: "bank_fee",
      description: "Biaya admin test",
      transactionDate: new Date(),
      referenceNumber: "OUTFLOW-TEST",
    });
    expect(outflow.success).toBe(true);

    const account = await db.query.bankAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
    });
    expect(Number(account?.balance ?? 0)).toBe(1150000);
  });

  it("rejects manual outflow when funds are insufficient", async () => {
    const accountId = await createOwnedAccount("insufficient", 50000);
    mockUserSession(FINANCE_USER);
    const result = await postManualCashMovement({
      bankAccountId: accountId,
      type: "OUTFLOW",
      amount: 75000,
      category: "bank_fee",
      description: "Biaya terlalu besar",
      transactionDate: new Date(),
      referenceNumber: "INSUFFICIENT-TEST",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("reconciles one exact bank statement row and prevents a second reconciliation", async () => {
    const accountId = await createOwnedAccount("reconciliation", 0);
    mockUserSession(FINANCE_USER);
    const posting = await postManualCashMovement({
      bankAccountId: accountId,
      type: "INFLOW",
      amount: 125000,
      category: "owner_capital",
      description: "Setoran untuk rekonsiliasi",
      transactionDate: new Date("2026-07-22T09:00:00Z"),
      referenceNumber: "RECONCILE-TEST",
    });
    expect(posting.success).toBe(true);
    if (!posting.success) return;
    expect(posting.data.reconciled).toBe(false);

    const statement = await recordBankStatementRow({
      bankAccountId: accountId,
      type: "INFLOW",
      amount: 125000,
      description: "Setoran untuk rekonsiliasi",
      transactionDate: new Date("2026-07-22T09:00:00Z"),
    });
    expect(statement.success).toBe(true);
    if (!statement.success) return;

    const duplicateFromCsv = await importBankStatementCsv({
      bankAccountId: accountId,
      fileName: "manual-duplicate.csv",
      content: [
        "tanggal,deskripsi,dana_masuk,dana_keluar",
        "2026-07-22,Setoran untuk rekonsiliasi,125000,",
      ].join("\n"),
    });
    expect(duplicateFromCsv.success).toBe(true);
    if (!duplicateFromCsv.success) return;
    expect(duplicateFromCsv.data.importedCount).toBe(0);
    expect(duplicateFromCsv.data.duplicateCount).toBe(1);

    const result = await reconcileCashTransaction({
      cashTransactionId: posting.data.id,
      bankStatementRowId: statement.data.statementRowId,
    });
    expect(result.success).toBe(true);
    const transaction = await db.query.cashTransaction.findFirst({
      where: (table, { eq }) => eq(table.id, posting.data.id),
    });
    expect(transaction?.reconciled).toBe(true);
    const workspace = await getReconciliationWorkspace();
    expect(workspace.success).toBe(true);
    if (workspace.success) {
      const history = workspace.data.history.find(
        (row) => row.cashTransactionId === posting.data.id,
      );
      expect(history?.statementDescription).toBe("Setoran untuk rekonsiliasi");
      expect(history?.reconciledByName).toBe(FINANCE_USER.name);
    }
    const duplicate = await reconcileCashTransaction({
      cashTransactionId: posting.data.id,
      bankStatementRowId: statement.data.statementRowId,
    });
    expect(duplicate.success).toBe(false);
  });

  it("imports canonical statement CSV without changing balance and skips duplicates", async () => {
    const accountId = await createOwnedAccount("csv-import", 0);
    mockUserSession(FINANCE_USER);
    const posting = await postManualCashMovement({
      bankAccountId: accountId,
      type: "INFLOW",
      amount: 500000,
      category: "owner_capital",
      description: "Pembayaran klien UAT",
      transactionDate: new Date("2026-07-20T12:00:00Z"),
      referenceNumber: "CSV-MATCH-001",
    });
    expect(posting.success).toBe(true);
    if (!posting.success) return;
    const input = {
      bankAccountId: accountId,
      fileName: "rekening-uat.csv",
      content: [
        "tanggal,deskripsi,dana_masuk,dana_keluar",
        "2026-07-20,Pembayaran klien UAT,500000,",
        "2026-07-21,Biaya admin UAT,,25000",
      ].join("\n"),
    };

    const firstImport = await importBankStatementCsv(input);
    expect(firstImport.success).toBe(true);
    if (!firstImport.success) return;
    expect(firstImport.data.importedCount).toBe(2);
    expect(firstImport.data.duplicateCount).toBe(0);

    const workspace = await getReconciliationWorkspace();
    expect(workspace.success).toBe(true);
    if (!workspace.success) return;
    const suggestedStatement = workspace.data.statementRows.find(
      (row) => row.bankAccountId === accountId && row.description === "Pembayaran klien UAT",
    );
    expect(suggestedStatement?.suggestedCashTransactionId).toBe(posting.data.id);
    expect(suggestedStatement?.candidateCount).toBe(1);

    const duplicateImport = await importBankStatementCsv(input);
    expect(duplicateImport.success).toBe(true);
    if (!duplicateImport.success) return;
    expect(duplicateImport.data.importedCount).toBe(0);
    expect(duplicateImport.data.duplicateCount).toBe(2);

    const account = await db.query.bankAccount.findFirst({
      where: (table, { eq }) => eq(table.id, accountId),
    });
    expect(Number(account?.balance ?? 0)).toBe(500000);
  });

  it("records and clears a documented reconciliation exception without marking a match", async () => {
    const accountId = await createOwnedAccount("reconciliation-exception", 0);
    mockUserSession(FINANCE_USER);
    const posting = await postManualCashMovement({
      bankAccountId: accountId,
      type: "INFLOW",
      amount: 275000,
      category: "correction",
      description: "Koreksi internal untuk pengecualian",
      transactionDate: new Date("2026-07-19T09:00:00Z"),
      referenceNumber: "EXCEPTION-TEST",
    });
    expect(posting.success).toBe(true);
    if (!posting.success) return;

    const marked = await markReconciliationException({
      cashTransactionId: posting.data.id,
      reason: "Koreksi pembukaan internal yang tidak memiliki mutasi bank terpisah.",
    });
    expect(marked.success).toBe(true);
    const markedTransaction = await db.query.cashTransaction.findFirst({
      where: (table, { eq }) => eq(table.id, posting.data.id),
    });
    expect(markedTransaction?.reconciled).toBe(false);
    expect(markedTransaction?.reconciliationExceptionById).toBe(FINANCE_USER.id);
    expect(markedTransaction?.reconciliationExceptionReason).toContain("Koreksi pembukaan");

    const cleared = await clearReconciliationException({ cashTransactionId: posting.data.id });
    expect(cleared.success).toBe(true);
    const clearedTransaction = await db.query.cashTransaction.findFirst({
      where: (table, { eq }) => eq(table.id, posting.data.id),
    });
    expect(clearedTransaction?.reconciliationExceptionAt).toBeNull();
    expect(clearedTransaction?.reconciliationExceptionReason).toBeNull();
  });

  it("blocks project closing until an unmatched project transaction is documented", async () => {
    const projectId = "77777777-7777-7777-7777-777777777771";
    const accountId = await createOwnedAccount("closing-reconciliation", 0);
    mockUserSession(FINANCE_USER);
    const baseline = await getProjectClosingChecklist(projectId);
    expect(baseline.success).toBe(true);
    if (!baseline.success) return;
    const posting = await postManualCashMovement({
      bankAccountId: accountId,
      type: "INFLOW",
      amount: 325000,
      category: "correction",
      description: "Fixture rekonsiliasi untuk closing",
      transactionDate: new Date("2026-07-18T09:00:00Z"),
      referenceNumber: "CLOSING-RECONCILIATION-TEST",
    });
    expect(posting.success).toBe(true);
    if (!posting.success) return;
    const [cost] = await db
      .insert(projectCost)
      .values({
        projectId,
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323104",
        requestedById: "33333333-3333-3333-3333-333333333331",
        quantity: "1.00",
        unitPrice: "325000.00",
        amount: "325000.00",
        description: "Fixture rekonsiliasi untuk closing",
        status: "PAID",
        bankAccountId: accountId,
        cashTransactionId: posting.data.id,
      })
      .returning();
    expect(cost).toBeDefined();

    try {
      const before = await getProjectClosingChecklist(projectId);
      expect(before.success).toBe(true);
      if (!before.success) return;
      expect(before.data.unresolvedReconciliationCount).toBe(
        baseline.data.unresolvedReconciliationCount + 1,
      );
      expect(before.data.blockers.some((blocker) => blocker.includes("belum cocok"))).toBe(true);

      const marked = await markReconciliationException({
        cashTransactionId: posting.data.id,
        reason: "Mutasi kas lapangan lama diterima sebagai pengecualian closing UAT.",
      });
      expect(marked.success).toBe(true);
      const after = await getProjectClosingChecklist(projectId);
      expect(after.success).toBe(true);
      if (!after.success) return;
      expect(after.data.unresolvedReconciliationCount).toBe(
        baseline.data.unresolvedReconciliationCount,
      );
      expect(after.data.documentedReconciliationExceptionCount).toBe(
        baseline.data.documentedReconciliationExceptionCount + 1,
      );
    } finally {
      await clearReconciliationException({ cashTransactionId: posting.data.id });
      if (cost) await db.delete(projectCost).where(eq(projectCost.id, cost.id));
    }
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
