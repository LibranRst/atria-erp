"use server";

import { asc, eq } from "drizzle-orm";

import { getOnboardingActor } from "@/app/actions/onboarding-action-utils";
import type { OwnerOnboardingBankAccount } from "@/app/actions/onboarding-types";
import { db } from "@/db";
import { bankAccount, cashTransaction } from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import type { ActionResponse } from "@/lib/types/action-response";

export async function getOwnerOnboardingBankAccounts(): Promise<
  ActionResponse<readonly OwnerOnboardingBankAccount[]>
> {
  const current = await getOnboardingActor();
  try {
    await assertPermission(current, "view:bank_account");
    const rows = await db.query.bankAccount.findMany({
      with: {
        cashTransactions: {
          where: eq(cashTransaction.referenceType, "opening_balance"),
          columns: {
            id: true,
            bankAccountId: true,
            type: true,
            category: true,
            amount: true,
            description: true,
            reconciled: true,
            referenceId: true,
            createdAt: true,
          },
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        },
      },
      orderBy: [asc(bankAccount.name)],
    });
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        holderName: row.holderName,
        balance: Number(row.balance),
        cardColorFrom: row.cardColorFrom,
        cardColorTo: row.cardColorTo,
        cardTextColor: row.cardTextColor === "dark" ? "dark" : "light",
        isActive: row.isActive,
        recentTransactions: row.cashTransactions.map((transaction) => ({
          ...transaction,
          amount: Number(transaction.amount),
        })),
        openingBalanceTransaction: row.cashTransactions[0]
          ? {
              id: row.cashTransactions[0].id,
              amount: Number(row.cashTransactions[0].amount),
              description: row.cashTransactions[0].description,
              referenceId: row.cashTransactions[0].referenceId,
            }
          : null,
      })),
    };
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Daftar rekening tidak dapat dimuat untuk onboarding.",
      },
    };
  }
}
