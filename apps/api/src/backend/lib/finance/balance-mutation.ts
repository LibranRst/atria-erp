import { db } from "@backend/db";
import { bankAccount, cashTransaction, auditLog } from "@backend/db/schema";
import { eq } from "drizzle-orm";
import type { CashDirection } from "@atria/core/finance/cash-direction";

import { parseNumericToCents, fromCents } from "@atria/core/finance/money-minor";
export { parseNumericToCents, fromCents } from "@atria/core/finance/money-minor";

interface MutateBalanceArgs {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  bankAccountId: string;
  type: CashDirection;
  amount: string; // Harus berformat string desimal (misal: "5000000.00")
  description: string;
  category: string;
  referenceType:
    | "client_payment"
    | "vendor_payment"
    | "project_cost"
    | "opening_balance"
    | "manual_cash_movement"
    | "bank_transfer";
  referenceId: string;
  bankReference?: string | null;
  userId: string;
  transactionDate?: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Melakukan mutasi saldo kas bank secara transaksional dengan penguncian pesimistis.
 * Fungsi ini memperbarui saldo bank, menulis entri buku besar (ledger), dan merekam riwayat audit.
 *
 * @param args Parameter mutasi saldo kas bank
 * @returns Data cash_transaction yang berhasil disisipkan
 */
export async function mutateBalance(
  args: MutateBalanceArgs,
): Promise<typeof cashTransaction.$inferSelect> {
  const {
    tx,
    bankAccountId,
    type,
    amount,
    description,
    category,
    referenceType,
    referenceId,
    userId,
    transactionDate,
    ipAddress,
    userAgent,
  } = args;

  // 1. Kunci baris akun bank target dengan pessimistic locking (.for('update'))
  const accounts = await tx
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.id, bankAccountId))
    .for("update");

  const account = accounts[0];
  if (!account) {
    throw new Error("BANK_ACCOUNT_NOT_FOUND: Akun kas bank tidak ditemukan.");
  }
  if (!account.isActive) {
    throw new Error(
      "BANK_ACCOUNT_INACTIVE: Rekening yang diarsipkan tidak dapat menerima mutasi baru.",
    );
  }

  // 2. Hitung saldo baru dengan satuan sen (bigint)
  const oldBalanceCents = parseNumericToCents(account.balance);
  const mutationCents = parseNumericToCents(amount);

  if (mutationCents <= BigInt(0)) {
    throw new Error("INVALID_AMOUNT: Nominal mutasi saldo wajib lebih besar dari nol.");
  }

  let newBalanceCents = oldBalanceCents;
  if (type === "INFLOW") {
    newBalanceCents = oldBalanceCents + mutationCents;
  } else if (type === "OUTFLOW") {
    newBalanceCents = oldBalanceCents - mutationCents;
    // Cek kecukupan saldo untuk mutasi keluar
    if (newBalanceCents < BigInt(0)) {
      throw new Error("INSUFFICIENT_FUNDS: Saldo kas bank tidak mencukupi untuk transaksi keluar.");
    }
  } else {
    throw new Error("INVALID_MUTATION_TYPE: Arah kas wajib berupa INFLOW atau OUTFLOW.");
  }

  const newBalanceStr = fromCents(newBalanceCents);

  // 3. Perbarui saldo bank
  const updatedAccounts = await tx
    .update(bankAccount)
    .set({
      balance: newBalanceStr,
      updatedAt: new Date(),
    })
    .where(eq(bankAccount.id, bankAccountId))
    .returning();

  // Enforce double check: periksa bahwa baris terupdate tepat satu baris
  if (updatedAccounts.length !== 1) {
    throw new Error("BALANCE_UPDATE_FAILED: Gagal memperbarui saldo kas bank.");
  }

  // Double check saldo akhir
  if (updatedAccounts[0].balance !== newBalanceStr) {
    throw new Error("BALANCE_MISMATCH: Saldo bank terupdate tidak cocok dengan hasil perhitungan.");
  }

  // 4. Internal postings remain unreconciled until a bank-statement match is approved.
  const [ledgerTx] = await tx
    .insert(cashTransaction)
    .values({
      bankAccountId,
      type,
      category,
      amount,
      description,
      reconciled: false,
      reconciliationDate: null,
      reconciledById: null,
      referenceType,
      referenceId,
      bankReference: args.bankReference?.trim() || null,
      createdAt: transactionDate ?? new Date(),
    })
    .returning();

  if (!ledgerTx) {
    throw new Error("LEDGER_INSERT_FAILED: Gagal memasukkan entri transaksi ke buku besar.");
  }

  // 5. Masukkan catatan perubahan ke audit_log
  await tx.insert(auditLog).values({
    userId,
    action: type === "INFLOW" ? "INFLOW_BANK_ACCOUNT" : "OUTFLOW_BANK_ACCOUNT",
    targetTable: "bank_account",
    targetId: bankAccountId,
    originalState: JSON.stringify({ balance: account.balance }),
    newState: JSON.stringify({ balance: newBalanceStr }),
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });

  return ledgerTx;
}
