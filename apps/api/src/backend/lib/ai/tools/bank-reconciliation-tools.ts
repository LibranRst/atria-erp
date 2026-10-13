import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@backend/db";
import {
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import { readPrivateAttachment } from "@backend/server/usecases/media/private-attachments";
import { analyzeBankStatementUseCase } from "@backend/server/usecases/ai/bank-statement-analyzer";
import {
  assertReconciliationRights,
  prepareReconciliationProposal,
} from "@backend/server/usecases/ai/reconciliation-context";
import { ReconciliationError } from "@backend/server/usecases/finance/reconciliation-writer";
import { reconciliationInputSchema } from "@atria/core/ai/bank-reconciliation";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
import type { AiToolContext } from "./context";
const failure = (error: unknown): { error: string } => ({
  error:
    error instanceof ReconciliationError
      ? error.message
      : "Data rekonsiliasi belum dapat dibaca. Periksa isian, lampiran dan akses lalu coba lagi.",
});
export function buildBankReconciliationTools(context: AiToolContext): ToolSet {
  return {
    getBankReconciliationContext: tool({
      description:
        "Read verified active bank IDs, paginated statement mutations and Atria cash records/history. Bank-domain reconcile grants govern access. Require a human-selected account; never pick the first account. Follow next offsets for complete lists. Statements do not create cash. Read EXCEPTIONS before proposing clear; same-account exact amounts/directions are required for matching.",
      inputSchema: z
        .object({
          bankAccountId: z.guid().optional(),
          offset: z.number().int().min(0).max(100000).default(0),
          status: z.enum(["UNMATCHED", "EXCEPTIONS", "MATCHED"]).default("UNMATCHED"),
        })
        .strict(),
      execute: async (input) => {
        try {
          assertReconciliationRights(context);
          const accounts = await db.query.bankAccount.findMany({
            where: and(
              eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
              input.status === "MATCHED" ? undefined : eq(bankAccount.isActive, true),
            ),
            orderBy: [asc(bankAccount.name)],
          });
          if (!input.bankAccountId)
            return {
              accounts: accounts.map((a) => ({
                id: a.id,
                name: a.name,
                bankName: a.bankName,
                accountNumber: a.accountNumber,
              })),
              instruction:
                "Minta pengguna memilih rekening. Jangan menerka rekening dari urutan daftar.",
            };
          if (!accounts.some((a) => a.id === input.bankAccountId))
            throw new ReconciliationError("NOT_FOUND", "Rekening aktif tidak ditemukan.");
          const statements = await db
            .select({ row: bankStatementRow, fileName: bankStatementImport.fileName })
            .from(bankStatementRow)
            .innerJoin(bankStatementImport, eq(bankStatementRow.importId, bankStatementImport.id))
            .where(
              and(
                eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
                eq(bankStatementImport.tenantId, INSTANCE_TENANT_ID),
                eq(bankStatementImport.bankAccountId, input.bankAccountId),
                eq(bankStatementRow.isReconciled, input.status === "MATCHED"),
              ),
            )
            .orderBy(asc(bankStatementRow.transactionDate), asc(bankStatementRow.id))
            .limit(21)
            .offset(input.offset);
          const cash = await db.query.cashTransaction.findMany({
            where: and(
              eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
              eq(cashTransaction.bankAccountId, input.bankAccountId),
              eq(cashTransaction.reconciled, input.status === "MATCHED"),
              input.status === "EXCEPTIONS"
                ? isNotNull(cashTransaction.reconciliationExceptionAt)
                : undefined,
            ),
            orderBy: [asc(cashTransaction.id)],
            limit: 21,
            offset: input.offset,
          });
          return {
            account: (() => {
              const a = accounts.find((a) => a.id === input.bankAccountId);
              return a
                ? { id: a.id, name: a.name, bankName: a.bankName, accountNumber: a.accountNumber }
                : null;
            })(),
            statements: statements.slice(0, 20).map((s) => ({
              id: s.row.id,
              date: s.row.transactionDate.toISOString().slice(0, 10),
              description: s.row.description,
              amount: Number(s.row.amount),
              type: normalizeCashDirection(s.row.type),
              source: s.fileName,
              matchedCashId: s.row.matchedCashTransactionId,
            })),
            cash: cash
              .slice(0, 20)
              .filter((c) => input.status !== "EXCEPTIONS" || c.reconciliationExceptionAt)
              .map((c) => ({
                id: c.id,
                date: c.createdAt.toISOString().slice(0, 10),
                description: c.description,
                amount: Number(c.amount),
                type: normalizeCashDirection(c.type),
                reference: c.bankReference,
                exception: c.reconciliationExceptionReason,
              })),
            nextOffset: statements.length > 20 || cash.length > 20 ? input.offset + 20 : null,
            instruction:
              "Rekening yang dipilih sudah terverifikasi pada account.id. Pakai ID ini untuk proposal tanpa mencari rekening lagi. Untuk seluruh antrean, gunakan MATCH allUnmatched:true (maksimal500), tanpa menyalin ID dari banyak page. Untuk subset, gunakan statements[].id untuk MATCH dan cash[].id untuk pengecualian. Jika jumlah mutasi kurang dari permintaan, siapkan yang tersedia; jangan berpindah rekening. Hanya lanjutkan page bila nextOffset ada. Kas ambigu dipilih user di review. Impor dan cocokkan adalah tindakan terpisah.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    analyzeBankStatementAttachment: tool({
      description:
        "Analyze one user-owned AI-chat attachment CSV/TXT/Excel/PDF/image as bank mutations only. Uses the existing bounded private attachment reader and analyzer; max500 rows, no silent truncation. Returns source rows and detected bank/account for review, never saves statement or cash. Ask which bank account to import into and propose IMPORT only after analysis. AttachmentURL must be the exact current user's uploaded Atria private attachment, not an external URL.",
      inputSchema: z
        .object({ attachmentUrl: z.string().url(), bankAccountId: z.guid().optional() })
        .strict(),
      execute: async (input) => {
        try {
          assertReconciliationRights(context);
          const actor = await resolveActor();
          if (!actor || actor.userId !== context.userId)
            throw new ReconciliationError("FORBIDDEN", "Sesi lampiran tidak sesuai.");
          const file = await readPrivateAttachment(actor, input.attachmentUrl, "ai_chat");
          const text = file.row.mimeType.startsWith("text/");
          const result = await analyzeBankStatementUseCase(actor, {
            fileName: file.row.fileName,
            mimeType: file.row.mimeType,
            fileContent: text ? file.bytes.toString("utf8") : undefined,
            fileBase64: text ? undefined : file.bytes.toString("base64"),
          });
          if (!result.success) return { error: result.error.message };
          const rows = result.data.rows.map((r) => ({
            transactionDate: r.transactionDate,
            description: r.description,
            amount: r.amount,
            type: r.type,
            source: `${file.row.fileName}${r.sheetName ? ` · ${r.sheetName}` : ""} · baris ${r.rowNumber}`,
          }));
          if (input.bankAccountId)
            return {
              proposal: await prepareReconciliationProposal(context, {
                action: "IMPORT",
                bankAccountId: input.bankAccountId,
                fileName: file.row.fileName,
                detectedAccountNumber: result.data.detectedAccountNumber ?? undefined,
                rows,
              }),
              instruction:
                "Seluruh baris dari lampiran disiapkan langsung dalam draft impor. Jangan menyalin atau memotong hasil lewat tool lain. User review dan konfirmasi sebelum mutasi tersimpan.",
            };
          return {
            ...result.data,
            fileName: file.row.fileName,
            rows,
            instruction:
              "Ini analisis, belum tersimpan. Minta user memilih rekening, lalu panggil analyzeBankStatementAttachment kembali dengan bankAccountId terverifikasi untuk menyiapkan seluruh baris langsung tanpa pemotongan.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeBankReconciliation: tool({
      description:
        "Prepare owned bank reconciliation IMPORT/MATCH/MARK_EXCEPTION/CLEAR_EXCEPTION preview. IMPORT accepts reviewed rows, explicit bankAccountId,fileName, optional detectedAccountNumber. MATCH uses existing statementRowIds OR allUnmatched:true for the entire verified account queue (max500), shows exact same-account candidates without arbitrary tie breaking. Exception needs human reason; clear uses current active exception. Never creates cash or writes business data. Large reviews keep selection/editing in a draft and require explicit confirmation.",
      inputSchema: reconciliationInputSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareReconciliationProposal(context, input),
            instruction:
              "Kartu review sudah disiapkan. Jelaskan tahap impor/pencocokan/pengecualian secara singkat; pengguna memilih dan mengonfirmasi. Jangan menyimpan otomatis atau menjanjikan perubahan saldo.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
