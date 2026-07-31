"use server";

import { asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  findSuggestedTransactionId,
  requireReconciliationUser,
} from "@/app/actions/finance/reconciliation-action-utils";
import type { ReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace-types";
import { db } from "@/db";
import { bankAccount, bankStatementRow, cashTransaction, projectCost } from "@/db/schema";
import { normalizeCashDirection } from "@/lib/finance/cash-direction";
import type { ActionResponse } from "@/lib/types/action-response";

export async function getReconciliationWorkspace(): Promise<
  ActionResponse<ReconciliationWorkspace>
> {
  const authResult = await requireReconciliationUser();
  if (!authResult.success) return authResult;
  try {
    const [accounts, transactions, statementRows, historyRows, historyCountRows] =
      await Promise.all([
        db.query.bankAccount.findMany({
          where: eq(bankAccount.isActive, true),
          orderBy: [asc(bankAccount.name)],
        }),
        db.query.cashTransaction.findMany({
          where: eq(cashTransaction.reconciled, false),
          with: { bankAccount: true, reconciliationExceptionBy: true },
          orderBy: [desc(cashTransaction.createdAt)],
          limit: 100,
        }),
        db.query.bankStatementRow.findMany({
          where: eq(bankStatementRow.isReconciled, false),
          with: { import: { with: { bankAccount: true } } },
          orderBy: [asc(bankStatementRow.transactionDate)],
          limit: 100,
        }),
        db.query.bankStatementRow.findMany({
          where: eq(bankStatementRow.isReconciled, true),
          with: {
            import: { with: { bankAccount: true } },
            matchedCashTransaction: { with: { reconciledBy: true } },
          },
          orderBy: [desc(bankStatementRow.createdAt)],
          limit: 500,
        }),
        db
          .select({ value: count() })
          .from(bankStatementRow)
          .where(eq(bankStatementRow.isReconciled, true)),
      ]);
    const projectCostReferenceIds = transactions.flatMap((transaction) =>
      transaction.referenceType === "project_cost" && transaction.referenceId
        ? [transaction.referenceId]
        : [],
    );
    const projectCostSources = projectCostReferenceIds.length
      ? await db.query.projectCost.findMany({
          where: inArray(projectCost.id, projectCostReferenceIds),
          with: { project: true },
        })
      : [];
    const projectCostSourceById = new Map(
      projectCostSources.map((cost) => [
        cost.id,
        {
          label: "Pengeluaran Lapangan" as const,
          projectName: cost.project.name,
          description: cost.description,
        },
      ]),
    );
    return {
      success: true,
      data: {
        bankAccounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          bankName: account.bankName,
        })),
        cashTransactions: transactions.map((row) => ({
          id: row.id,
          bankAccountId: row.bankAccountId,
          bankAccountName: row.bankAccount.name,
          type: normalizeCashDirection(row.type),
          amount: Number(row.amount),
          description: row.description,
          source:
            row.referenceType === "project_cost" && row.referenceId
              ? (projectCostSourceById.get(row.referenceId) ?? null)
              : null,
          bankReference: row.bankReference,
          createdAt: row.createdAt,
          ageDays: Math.max(
            0,
            Math.floor((Date.now() - row.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
          ),
          exceptionReason: row.reconciliationExceptionReason,
          exceptionAt: row.reconciliationExceptionAt,
          exceptionByName: row.reconciliationExceptionBy?.name ?? null,
        })),
        statementRows: statementRows.map((row) => {
          const type = normalizeCashDirection(row.type);
          const suggestion = findSuggestedTransactionId(
            {
              bankAccountId: row.import.bankAccountId,
              type,
              amount: row.amount,
              description: row.description,
            },
            transactions,
          );
          return {
            id: row.id,
            bankAccountId: row.import.bankAccountId,
            bankAccountName: row.import.bankAccount.name,
            type,
            amount: Number(row.amount),
            description: row.description,
            transactionDate: row.transactionDate,
            suggestedCashTransactionId: suggestion.id,
            candidateCount: suggestion.candidateCount,
          };
        }),
        history: historyRows
          .flatMap((row) => {
            const transaction = row.matchedCashTransaction;
            if (!transaction?.reconciliationDate || !transaction.reconciledBy) return [];
            return [
              {
                id: row.id,
                cashTransactionId: transaction.id,
                bankAccountName: row.import.bankAccount.name,
                type: normalizeCashDirection(transaction.type),
                amount: Number(transaction.amount),
                cashDescription: transaction.description,
                statementDescription: row.description,
                bankReference: transaction.bankReference,
                transactionDate: row.transactionDate,
                reconciledAt: transaction.reconciliationDate,
                reconciledByName: transaction.reconciledBy.name,
                importFileName: row.import.fileName,
              },
            ];
          })
          .sort((left, right) => right.reconciledAt.getTime() - left.reconciledAt.getTime())
          .slice(0, 100),
        historyTotal: Number(historyCountRows[0]?.value ?? 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Gagal memuat rekonsiliasi.",
      },
    };
  }
}
