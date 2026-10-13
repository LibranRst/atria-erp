import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import {
  bankAccount,
  cashTransaction,
  auditLog,
  tenant,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import {
  mutateBalance,
  parseNumericToCents,
  fromCents,
} from "@backend/lib/finance/balance-mutation";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import type { FinanceTransaction } from "./mutation-access";
import {
  bankCreatePayloadSchema,
  bankEditPayloadSchema,
  bankMoneySchema,
} from "@atria/core/ai/bank-cash";
import {
  postManualCashMovementSchema,
  transferBetweenBankAccountsSchema,
} from "@atria/core/validations/finance";

type BankRow = typeof bankAccount.$inferSelect;
export async function lockBankCatalog(tx: FinanceTransaction): Promise<void> {
  const rows = await tx
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.id, INSTANCE_TENANT_ID))
    .for("update");
  if (!rows.length) throw new Error("BANK_ACCOUNT_NOT_FOUND");
}
export async function lockBankAccounts(
  tx: FinanceTransaction,
  ids: readonly string[],
): Promise<BankRow[]> {
  const unique = [...new Set(ids)].sort();
  const rows = await tx
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.tenantId, INSTANCE_TENANT_ID), inArray(bankAccount.id, unique)))
    .orderBy(asc(bankAccount.id))
    .for("update");
  if (rows.length !== unique.length) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  return rows;
}
export async function assertBankNumberAvailable(
  tx: Pick<FinanceTransaction, "query">,
  accountNumber: string,
  exceptId?: string,
): Promise<void> {
  const duplicate = await tx.query.bankAccount.findFirst({
    where: and(
      eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
      eq(bankAccount.accountNumber, accountNumber.trim()),
      exceptId ? ne(bankAccount.id, exceptId) : undefined,
    ),
    columns: { id: true },
  });
  if (duplicate) throw new Error("BANK_ACCOUNT_DUPLICATE_NUMBER");
}
export async function assertBankReferenceAvailable(
  tx: Pick<FinanceTransaction, "query">,
  bankAccountId: string,
  reference?: string | null,
): Promise<void> {
  if (!reference?.trim()) return;
  const duplicate = await tx.query.cashTransaction.findFirst({
    where: and(
      eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
      eq(cashTransaction.bankAccountId, bankAccountId),
      eq(cashTransaction.bankReference, reference.trim()),
    ),
    columns: { id: true },
  });
  if (duplicate) throw new Error("DUPLICATE_BANK_REFERENCE");
}
function assertCashAccount(row: BankRow, amount: number, inflow: boolean): void {
  if (!row.isActive) throw new Error("BANK_ACCOUNT_INACTIVE");
  const next =
    parseNumericToCents(row.balance) + (inflow ? 1n : -1n) * parseNumericToCents(amount.toFixed(2));
  if (next < 0n) throw new Error("INSUFFICIENT_FUNDS");
  bankMoneySchema.parse(Number(fromCents(next)));
}
export async function createBankAccountTx(
  tx: FinanceTransaction,
  userId: string,
  raw: z.input<typeof bankCreatePayloadSchema>,
  openingDate?: Date,
): Promise<BankRow> {
  const input = bankCreatePayloadSchema.parse(raw);
  await lockBankCatalog(tx);
  await assertBankNumberAvailable(tx, input.accountNumber);
  const [created] = await tx
    .insert(bankAccount)
    .values({
      tenantId: INSTANCE_TENANT_ID,
      name: input.name,
      accountNumber: input.accountNumber,
      bankName: input.bankName,
      holderName: input.holderName,
      cardColorFrom: input.cardColorFrom,
      cardColorTo: input.cardColorTo,
      cardTextColor: input.cardTextColor,
      balance: "0.00",
      isActive: true,
    })
    .returning();
  if (!created) throw new Error("BANK_ACCOUNT_CREATE_FAILED");
  await tx.insert(auditLog).values({
    userId,
    action: "CREATE_BANK_ACCOUNT",
    targetTable: "bank_account",
    targetId: created.id,
    newState: JSON.stringify(created),
  });
  if (input.openingBalance > 0)
    await mutateBalance({
      tx,
      bankAccountId: created.id,
      type: "INFLOW",
      amount: input.openingBalance.toFixed(2),
      category: "opening_balance",
      description: input.openingNote?.trim() || `Saldo awal ${created.name}`,
      referenceType: "opening_balance",
      referenceId: crypto.randomUUID(),
      bankReference: input.openingReference,
      userId,
      transactionDate: openingDate,
    });
  await recordReadinessMilestonesTx({ tx, actorUserId: userId, changedItem: "bank_account" });
  const row = await tx.query.bankAccount.findFirst({
    where: and(eq(bankAccount.id, created.id), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!row) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  return row;
}
export async function updateBankAccountTx(
  tx: FinanceTransaction,
  userId: string,
  raw: z.input<typeof bankEditPayloadSchema>,
): Promise<BankRow> {
  const input = bankEditPayloadSchema.parse(raw);
  await lockBankCatalog(tx);
  const [existing] = await lockBankAccounts(tx, [input.bankAccountId]);
  await assertBankNumberAvailable(tx, input.accountNumber, existing.id);
  const [row] = await tx
    .update(bankAccount)
    .set({
      name: input.name,
      accountNumber: input.accountNumber,
      bankName: input.bankName,
      holderName: input.holderName,
      cardColorFrom: input.cardColorFrom,
      cardColorTo: input.cardColorTo,
      cardTextColor: input.cardTextColor,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(bankAccount.id, existing.id), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)))
    .returning();
  if (!row) throw new Error("BANK_ACCOUNT_UPDATE_FAILED");
  await tx.insert(auditLog).values({
    userId,
    action: "UPDATE_BANK_ACCOUNT",
    targetTable: "bank_account",
    targetId: row.id,
    originalState: JSON.stringify(existing),
    newState: JSON.stringify(row),
  });
  return row;
}
export async function setBankAccountActiveTx(
  tx: FinanceTransaction,
  userId: string,
  id: string,
  isActive: boolean,
): Promise<BankRow> {
  await lockBankCatalog(tx);
  const [existing] = await lockBankAccounts(tx, [id]);
  const [row] = await tx
    .update(bankAccount)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(bankAccount.id, id), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)))
    .returning();
  if (!row) throw new Error("BANK_ACCOUNT_UPDATE_FAILED");
  await tx.insert(auditLog).values({
    userId,
    action: isActive ? "REACTIVATE_BANK_ACCOUNT" : "ARCHIVE_BANK_ACCOUNT",
    targetTable: "bank_account",
    targetId: id,
    originalState: JSON.stringify(existing),
    newState: JSON.stringify({ isActive }),
  });
  return row;
}
export async function postManualCashMovementTx(
  tx: FinanceTransaction,
  userId: string,
  raw: z.input<typeof postManualCashMovementSchema>,
): Promise<typeof cashTransaction.$inferSelect> {
  const input = postManualCashMovementSchema.parse(raw);
  bankMoneySchema.parse(input.amount);
  const [account] = await lockBankAccounts(tx, [input.bankAccountId]);
  assertCashAccount(account, input.amount, input.type === "INFLOW");
  await assertBankReferenceAvailable(tx, account.id, input.referenceNumber);
  const reference = input.referenceNumber?.trim();
  return mutateBalance({
    tx,
    bankAccountId: account.id,
    type: input.type,
    amount: input.amount.toFixed(2),
    category: input.category,
    description: input.description.trim() + (reference ? ` (${reference})` : ""),
    referenceType: "manual_cash_movement",
    referenceId: crypto.randomUUID(),
    bankReference: reference,
    userId,
    transactionDate: input.transactionDate,
  });
}
export async function transferBetweenBankAccountsTx(
  tx: FinanceTransaction,
  userId: string,
  raw: z.input<typeof transferBetweenBankAccountsSchema>,
): Promise<{ readonly transferId: string }> {
  const input = transferBetweenBankAccountsSchema.parse(raw);
  bankMoneySchema.parse(input.amount);
  const accounts = await lockBankAccounts(tx, [input.fromBankAccountId, input.toBankAccountId]);
  const from = accounts.find((a) => a.id === input.fromBankAccountId),
    to = accounts.find((a) => a.id === input.toBankAccountId);
  if (!from || !to) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  assertCashAccount(from, input.amount, false);
  assertCashAccount(to, input.amount, true);
  await assertBankReferenceAvailable(tx, from.id, input.referenceNumber);
  await assertBankReferenceAvailable(tx, to.id, input.referenceNumber);
  const transferId = crypto.randomUUID(),
    reference = input.referenceNumber?.trim(),
    suffix = reference ? ` (${reference})` : "";
  await mutateBalance({
    tx,
    bankAccountId: from.id,
    type: "OUTFLOW",
    amount: input.amount.toFixed(2),
    category: "bank_transfer_out",
    description: `${input.description.trim()} ke ${to.name}${suffix}`,
    referenceType: "bank_transfer",
    referenceId: transferId,
    bankReference: reference,
    userId,
    transactionDate: input.transactionDate,
  });
  await mutateBalance({
    tx,
    bankAccountId: to.id,
    type: "INFLOW",
    amount: input.amount.toFixed(2),
    category: "bank_transfer_in",
    description: `${input.description.trim()} dari ${from.name}${suffix}`,
    referenceType: "bank_transfer",
    referenceId: transferId,
    bankReference: reference,
    userId,
    transactionDate: input.transactionDate,
  });
  return { transferId };
}
