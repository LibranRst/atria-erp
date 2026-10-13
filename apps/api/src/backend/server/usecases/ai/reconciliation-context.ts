import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { ReconciliationError } from "../finance/reconciliation-writer";
import { createStatementFingerprint } from "@backend/app/actions/finance/reconciliation-action-utils";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
import {
  reconciliationInputSchema,
  reconciliationProposalSchema,
  suggestedCashId,
  type ReconciliationCandidate,
  type ReconciliationProposal,
} from "@atria/core/ai/bank-reconciliation";
type Access = Pick<Actor, "userId" | "permissions" | "dataScope">;
export function assertReconciliationRights(actor: Pick<Actor, "permissions">): void {
  if (
    !["use:ai_chat", "reconcile:ledger", "view:bank_account"].every((p) =>
      actor.permissions.some((v) => v === p),
    )
  )
    throw new ReconciliationError("FORBIDDEN", "Akses chat, rekening dan rekonsiliasi diperlukan.");
}
const candidate = (row: typeof cashTransaction.$inferSelect): ReconciliationCandidate => ({
  id: row.id,
  description: row.description,
  date: row.createdAt.toISOString().slice(0, 10),
  amount: Number(row.amount),
  type: normalizeCashDirection(row.type),
  reference: row.bankReference,
  exception: row.reconciliationExceptionReason,
});
export async function prepareReconciliationProposal(
  actor: Access,
  raw: unknown,
  reader: Pick<FinanceTransaction, "query" | "select"> = db,
): Promise<ReconciliationProposal> {
  assertReconciliationRights(actor);
  const input = reconciliationInputSchema.parse(raw);
  const account = await reader.query.bankAccount.findFirst({
    where: and(
      eq(bankAccount.id, input.bankAccountId),
      eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!account)
    throw new ReconciliationError("NOT_FOUND", "Rekening tidak ditemukan atau di luar akses Anda.");
  if (!account.isActive)
    throw new ReconciliationError("CONFLICT", "Rekening nonaktif. Pilih rekening aktif.");
  const rows: ReconciliationProposal["rows"] = [];
  let exception: ReconciliationCandidate | null = null,
    source: unknown = null,
    title = "",
    warning: string | null = null;
  if (input.action === "IMPORT") {
    title = "Impor mutasi bank";
    if (
      input.detectedAccountNumber &&
      input.detectedAccountNumber.replace(/\s/g, "") !== account.accountNumber.replace(/\s/g, "")
    )
      warning = `Nomor rekening pada sumber (${input.detectedAccountNumber}) berbeda dari rekening tujuan. Periksa dan minta usulan pada rekening yang benar.`;
    const fingerprints = input.rows.map((m) =>
      createStatementFingerprint({
        ...m,
        bankAccountId: account.id,
        transactionDate: new Date(m.transactionDate),
        amount: m.amount.toFixed(2),
      }),
    );
    const stored = await reader.query.bankStatementRow.findMany({
      where: and(
        eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
        inArray(bankStatementRow.fingerprint, fingerprints),
      ),
      orderBy: [asc(bankStatementRow.id)],
    });
    source = stored.map((r) => ({
      id: r.id,
      fingerprint: r.fingerprint,
      isReconciled: r.isReconciled,
    }));
    const seen = new Set(stored.map((r) => r.fingerprint));
    input.rows.forEach((m, i) => {
      const fingerprint = fingerprints[i]!;
      const duplicate = seen.has(fingerprint);
      seen.add(fingerprint);
      rows.push({
        rowId: `import-${i + 1}`,
        statementRowId: null,
        mutation: m,
        fingerprint,
        duplicate,
        selected: !duplicate,
        candidates: [],
        chosenCashId: null,
      });
    });
  } else if (input.action === "MATCH") {
    title = "Cocokkan mutasi bank";
    if (
      input.statementRowIds &&
      new Set(input.statementRowIds).size !== input.statementRowIds.length
    )
      throw new ReconciliationError("VALIDATION_ERROR", "Mutasi tidak boleh berulang.");
    const statements = await reader
      .select({ row: bankStatementRow })
      .from(bankStatementRow)
      .innerJoin(bankStatementImport, eq(bankStatementRow.importId, bankStatementImport.id))
      .where(
        and(
          eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
          eq(bankStatementImport.tenantId, INSTANCE_TENANT_ID),
          eq(bankStatementImport.bankAccountId, account.id),
          input.statementRowIds
            ? inArray(bankStatementRow.id, input.statementRowIds)
            : eq(bankStatementRow.isReconciled, false),
        ),
      )
      .orderBy(asc(bankStatementRow.transactionDate), asc(bankStatementRow.id))
      .limit(501);
    if (statements.length > 500)
      throw new ReconciliationError(
        "VALIDATION_ERROR",
        "Maksimal 500 mutasi per review. Pilih subset dari antrean.",
      );
    if (!statements.length)
      throw new ReconciliationError(
        "VALIDATION_ERROR",
        "Belum ada mutasi tersimpan yang perlu dicocokkan. Impor sumber dahulu.",
      );
    if (
      (input.statementRowIds && statements.length !== input.statementRowIds.length) ||
      statements.some((s) => s.row.isReconciled || s.row.matchedCashTransactionId)
    )
      throw new ReconciliationError(
        "CONFLICT",
        "Mutasi tidak tersedia atau sudah direkonsiliasi. Baca sumber terbaru.",
      );
    const cash = await reader.query.cashTransaction.findMany({
      where: and(
        eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
        eq(cashTransaction.bankAccountId, account.id),
        eq(cashTransaction.reconciled, false),
        inArray(
          cashTransaction.amount,
          statements.map((s) => s.row.amount),
        ),
      ),
      orderBy: [asc(cashTransaction.id)],
      limit: 2001,
    });
    if (cash.length > 2000)
      throw new ReconciliationError(
        "VALIDATION_ERROR",
        "Kandidat terlalu banyak. Pecah pencocokan menjadi daftar lebih kecil.",
      );
    source = { statements: statements.map((s) => s.row), cash };
    const used = new Set<string>();
    for (const s of statements) {
      const mutation = {
        transactionDate: s.row.transactionDate.toISOString().slice(0, 10),
        description: s.row.description,
        amount: Number(s.row.amount),
        type: normalizeCashDirection(s.row.type),
      };
      const candidates = cash
        .filter(
          (c) =>
            Number(c.amount) === mutation.amount &&
            normalizeCashDirection(c.type) === mutation.type,
        )
        .map(candidate);
      if (candidates.length > 50)
        throw new ReconciliationError(
          "VALIDATION_ERROR",
          "Satu mutasi memiliki lebih dari 50 kandidat. Periksa pasangan melalui halaman Rekonsiliasi.",
        );
      const chosenCashId = suggestedCashId(mutation, candidates),
        selected = chosenCashId !== null && !used.has(chosenCashId);
      if (selected && chosenCashId) used.add(chosenCashId);
      rows.push({
        rowId: s.row.id,
        statementRowId: s.row.id,
        mutation,
        fingerprint:
          s.row.fingerprint ??
          createStatementFingerprint({
            ...mutation,
            bankAccountId: account.id,
            transactionDate: s.row.transactionDate,
            amount: s.row.amount,
          }),
        duplicate: false,
        selected,
        candidates,
        chosenCashId,
      });
    }
  } else {
    const cash = await reader.query.cashTransaction.findFirst({
      where: and(
        eq(cashTransaction.id, input.cashTransactionId),
        eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
        eq(cashTransaction.bankAccountId, account.id),
      ),
    });
    if (!cash)
      throw new ReconciliationError("NOT_FOUND", "Catatan kas tidak ditemukan di rekening ini.");
    if (cash.reconciled)
      throw new ReconciliationError(
        "CONFLICT",
        "Transaksi yang sudah cocok tidak dapat diubah status pengecualiannya.",
      );
    if (input.action === "CLEAR_EXCEPTION" && !cash.reconciliationExceptionAt)
      throw new ReconciliationError("CONFLICT", "Transaksi tidak memiliki pengecualian aktif.");
    exception = candidate(cash);
    source = cash;
    title =
      input.action === "MARK_EXCEPTION"
        ? "Tandai pengecualian rekonsiliasi"
        : "Hapus pengecualian rekonsiliasi";
  }
  const expectedContext = createHash("sha256")
    .update(
      JSON.stringify({
        account: {
          id: account.id,
          isActive: account.isActive,
          name: account.name,
          accountNumber: account.accountNumber,
        },
        source,
      }),
    )
    .digest("hex");
  return reconciliationProposalSchema.parse({
    kind: "BANK_RECONCILIATION_WORKFLOW",
    input,
    title,
    bankAccountId: account.id,
    bankAccountName: account.name,
    accountNumber: account.accountNumber,
    expectedContext,
    rows,
    exception,
    warning,
    effect:
      input.action === "IMPORT"
        ? "Menyimpan mutasi untuk dicocokkan. Tidak membuat catatan kas atau mengubah saldo."
        : input.action === "MATCH"
          ? "Menandai pasangan yang dipilih sebagai cocok. Saldo, budget dan stok tetap."
          : input.action === "MARK_EXCEPTION"
            ? "Mencatat alasan pengecualian; transaksi tetap belum cocok. Saldo dan stok tetap."
            : "Mengembalikan transaksi ke antrean belum cocok. Saldo dan stok tetap.",
  });
}
