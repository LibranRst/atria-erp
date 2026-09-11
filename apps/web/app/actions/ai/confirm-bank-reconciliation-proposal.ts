"use server";

import { createStatementFingerprint } from "@/app/actions/finance/reconciliation-action-utils";
import { db } from "@/db";
import {
  aiConversation,
  aiProposalConfirmation,
  auditLog,
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
} from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import { parseNumericToCents } from "@/lib/finance/balance-mutation";
import { getServerSession } from "@/lib/server/session";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiBankReconciliationProposalSchema } from "@atria/core/validations/ai-proposal";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type ConfirmAiBankReconciliationResult = {
  readonly importId: string;
  readonly matchedCount: number;
  readonly alreadyConfirmed: boolean;
};

export async function confirmAiBankReconciliationProposal(
  input: unknown,
): Promise<ActionResponse<ConfirmAiBankReconciliationResult>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  try {
    await assertPermission(session.user, "reconcile:ledger");
  } catch {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Anda tidak memiliki izin rekonsiliasi kas." },
    };
  }

  const validation = aiBankReconciliationProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data usulan rekonsiliasi tidak valid.",
      },
    };
  }

  const proposal = validation.data;

  if (
    proposal.matches.length === 0 &&
    (!proposal.importUnmatched ||
      !proposal.unmatchedMutations ||
      proposal.unmatchedMutations.length === 0)
  ) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Pilih minimal satu mutasi untuk direkonsiliasi atau centang impor mutasi.",
      },
    };
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      // 1. Verifikasi percakapan milik pengguna
      const [conversation] = await tx
        .select({ id: aiConversation.id })
        .from(aiConversation)
        .where(
          and(
            eq(aiConversation.id, proposal.conversationId),
            eq(aiConversation.userId, session.user.id),
          ),
        )
        .for("update");

      if (!conversation) {
        return { kind: "not_found" } as const;
      }

      // 2. Idempotensi usulan
      const existing = await tx.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
        columns: { documentId: true, userId: true },
      });

      if (existing) {
        if (existing.userId !== session.user.id) {
          return { kind: "foreign" } as const;
        }
        return {
          kind: "already" as const,
          importId: existing.documentId,
          matchedCount: proposal.matches.length,
        };
      }

      // 3. Kunci akun bank
      const account = await tx.query.bankAccount.findFirst({
        where: and(eq(bankAccount.id, proposal.bankAccountId), eq(bankAccount.isActive, true)),
      });

      if (!account) {
        return { kind: "account_not_found" } as const;
      }

      // Hitung rentang tanggal mutasi
      const allDates = [
        ...proposal.matches.map((m) => m.statementRow.transactionDate.getTime()),
        ...(proposal.unmatchedMutations ?? []).map((m) => m.transactionDate.getTime()),
      ];
      const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
      const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();

      // 4. Buat record import mutasi bank
      const [statementImport] = await tx
        .insert(bankStatementImport)
        .values({
          bankAccountId: account.id,
          fileName: `Rekonsiliasi AI Chat - ${new Date().toLocaleDateString("id-ID")}`,
          fileUrl: "ai-chat://reconciliation",
          importedById: session.user.id,
          startDate: minDate,
          endDate: maxDate,
        })
        .returning();

      if (!statementImport) {
        throw new Error("Gagal membuat data impor rekening koran.");
      }

      // 5. Proses pasangan yang cocok (matches)
      const processedFingerprints = new Set<string>();

      for (const match of proposal.matches) {
        const [txRow] = await tx
          .select()
          .from(cashTransaction)
          .where(eq(cashTransaction.id, match.cashTransactionId))
          .for("update");

        if (!txRow) {
          throw new Error("Transaksi kas tidak ditemukan.");
        }
        if (txRow.reconciled) {
          throw new Error("Transaksi kas sudah direkonsiliasi sebelumnya.");
        }
        if (txRow.bankAccountId !== account.id) {
          throw new Error("Rekening transaksi kas tidak cocok dengan rekening yang dipilih.");
        }

        const matchDir = normalizeCashDirection(match.statementRow.type);
        const txDir = normalizeCashDirection(txRow.type);
        if (matchDir !== txDir) {
          throw new Error("Arah mutasi tidak sesuai dengan transaksi kas.");
        }

        const amountStr = match.statementRow.amount.toFixed(2);
        const matchCents = parseNumericToCents(amountStr);
        const txCents = parseNumericToCents(txRow.amount);
        if (matchCents !== txCents) {
          throw new Error("Nominal mutasi tidak sama persis dengan transaksi kas.");
        }

        const fingerprint = createStatementFingerprint({
          bankAccountId: account.id,
          transactionDate: match.statementRow.transactionDate,
          type: match.statementRow.type,
          amount: amountStr,
          description: match.statementRow.description,
        });
        processedFingerprints.add(fingerprint);

        // Cari apakah baris mutasi bank dengan sidik jari ini sudah ada
        const existingRow = await tx.query.bankStatementRow.findFirst({
          where: eq(bankStatementRow.fingerprint, fingerprint),
        });

        let targetStatementRowId: string;
        if (existingRow) {
          if (existingRow.isReconciled) {
            throw new Error("Baris rekening koran sudah direkonsiliasi.");
          }
          await tx
            .update(bankStatementRow)
            .set({
              isReconciled: true,
              matchedCashTransactionId: txRow.id,
            })
            .where(eq(bankStatementRow.id, existingRow.id));
          targetStatementRowId = existingRow.id;
        } else {
          const [newRow] = await tx
            .insert(bankStatementRow)
            .values({
              importId: statementImport.id,
              transactionDate: match.statementRow.transactionDate,
              description: match.statementRow.description.trim(),
              amount: amountStr,
              type: match.statementRow.type,
              fingerprint,
              isReconciled: true,
              matchedCashTransactionId: txRow.id,
            })
            .returning();
          if (!newRow) {
            throw new Error("Gagal mencatat baris rekening koran.");
          }
          targetStatementRowId = newRow.id;
        }

        // Update transaksi kas menjadi terekonsiliasi
        await tx
          .update(cashTransaction)
          .set({
            reconciled: true,
            reconciliationDate: new Date(),
            reconciledById: session.user.id,
            reconciliationExceptionReason: null,
            reconciliationExceptionAt: null,
            reconciliationExceptionById: null,
          })
          .where(eq(cashTransaction.id, txRow.id));

        // Audit log untuk setiap rekonsiliasi kas
        await tx.insert(auditLog).values({
          userId: session.user.id,
          action: "RECONCILE_CASH_TRANSACTION",
          targetTable: "cash_transaction",
          targetId: txRow.id,
          originalState: JSON.stringify({ reconciled: false, bankStatementRowId: null }),
          newState: JSON.stringify({
            reconciled: true,
            bankStatementRowId: targetStatementRowId,
            matchedFromAi: true,
          }),
        });
      }

      // 6. Jika importUnmatched aktif, simpan mutasi yang belum tercatat
      if (
        proposal.importUnmatched &&
        proposal.unmatchedMutations &&
        proposal.unmatchedMutations.length > 0
      ) {
        for (const unmatched of proposal.unmatchedMutations) {
          const amountStr = unmatched.amount.toFixed(2);
          const fingerprint = createStatementFingerprint({
            bankAccountId: account.id,
            transactionDate: unmatched.transactionDate,
            type: unmatched.type,
            amount: amountStr,
            description: unmatched.description,
          });

          if (processedFingerprints.has(fingerprint)) {
            continue;
          }
          processedFingerprints.add(fingerprint);

          const existingUnmatched = await tx.query.bankStatementRow.findFirst({
            where: eq(bankStatementRow.fingerprint, fingerprint),
          });

          if (!existingUnmatched) {
            await tx.insert(bankStatementRow).values({
              importId: statementImport.id,
              transactionDate: unmatched.transactionDate,
              description: unmatched.description.trim(),
              amount: amountStr,
              type: unmatched.type,
              fingerprint,
              isReconciled: false,
              matchedCashTransactionId: null,
            });
          }
        }
      }

      // 7. Catat konfirmasi usulan AI
      await tx.insert(aiProposalConfirmation).values({
        toolCallId: proposal.toolCallId,
        conversationId: conversation.id,
        userId: session.user.id,
        proposalType: "BANK_RECONCILIATION",
        documentId: statementImport.id,
      });

      // 8. Audit log untuk konfirmasi rekonsiliasi AI
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: "CONFIRM_AI_BANK_RECONCILIATION",
        targetTable: "bank_statement_import",
        targetId: statementImport.id,
        newState: JSON.stringify({
          bankAccountId: account.id,
          matchedCount: proposal.matches.length,
          unmatchedCount: proposal.unmatchedMutations?.length ?? 0,
        }),
      });

      return {
        kind: "created" as const,
        importId: statementImport.id,
        matchedCount: proposal.matches.length,
      };
    });

    if (outcome.kind === "not_found") {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." },
      };
    }
    if (outcome.kind === "foreign") {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Usulan ini bukan milik Anda." },
      };
    }
    if (outcome.kind === "account_not_found") {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Akun bank aktif tidak ditemukan." },
      };
    }

    revalidatePath("/reconciliation");
    revalidatePath("/ledger");

    return {
      success: true,
      data: {
        importId: outcome.importId,
        matchedCount: outcome.matchedCount,
        alreadyConfirmed: outcome.kind === "already",
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal mengeksekusi rekonsiliasi bank.";
    return {
      success: false,
      error: { code: "TRANSACTION_FAILED", message },
    };
  }
}
