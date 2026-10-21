import { z } from "zod";
import { bankMoneySchema } from "./bank-cash";
import { parseNumericToCents } from "../finance/money-minor";

export const RECONCILIATION_KIND = "BANK_RECONCILIATION_WORKFLOW";
export const statementMutationSchema = z
  .object({
    transactionDate: z.iso.date(),
    description: z.string().trim().min(3).max(500),
    amount: bankMoneySchema.refine((n) => n > 0, "Nominal harus lebih dari nol."),
    type: z.enum(["INFLOW", "OUTFLOW"]),
    source: z.string().max(500).optional(),
  })
  .strict();
export const reconciliationInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("IMPORT"),
      bankAccountId: z.guid(),
      fileName: z.string().trim().min(1).max(255),
      detectedAccountNumber: z.string().optional(),
      rows: z.array(statementMutationSchema).min(1).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("MATCH"),
      bankAccountId: z.guid(),
      statementRowIds: z.array(z.guid()).min(1).max(500).optional(),
      allUnmatched: z.literal(true).optional(),
    })
    .strict()
    .refine(
      (input) => Boolean(input.statementRowIds) !== Boolean(input.allUnmatched),
      "Pilih daftar mutasi atau seluruh antrean, bukan keduanya.",
    ),
  z
    .object({
      action: z.literal("MARK_EXCEPTION"),
      bankAccountId: z.guid(),
      cashTransactionId: z.guid(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("CLEAR_EXCEPTION"),
      bankAccountId: z.guid(),
      cashTransactionId: z.guid(),
    })
    .strict(),
]);
export type ReconciliationInput = z.infer<typeof reconciliationInputSchema>;
const cashCandidateSchema = z.object({
  id: z.guid(),
  description: z.string(),
  date: z.string(),
  reference: z.string().nullable(),
  amount: bankMoneySchema,
  type: z.enum(["INFLOW", "OUTFLOW"]),
  exception: z.string().nullable(),
});
export type ReconciliationCandidate = z.infer<typeof cashCandidateSchema>;
export const reconciliationRowSchema = z.object({
  rowId: z.string(),
  statementRowId: z.guid().nullable(),
  mutation: statementMutationSchema,
  fingerprint: z.string().length(64),
  duplicate: z.boolean(),
  selected: z.boolean(),
  candidates: z.array(cashCandidateSchema),
  chosenCashId: z.guid().nullable(),
});
export const reconciliationProposalSchema = z.object({
  kind: z.literal(RECONCILIATION_KIND),
  input: reconciliationInputSchema,
  title: z.string(),
  bankAccountId: z.guid(),
  bankAccountName: z.string(),
  accountNumber: z.string(),
  expectedContext: z.string().length(64),
  rows: z.array(reconciliationRowSchema).max(500),
  exception: cashCandidateSchema.nullable(),
  warning: z.string().nullable(),
  effect: z.string(),
});
export type ReconciliationProposal = z.infer<typeof reconciliationProposalSchema>;
export const reconciliationIdentitySchema = z
  .object({ conversationId: z.guid(), toolCallId: z.string().min(1).max(150) })
  .strict();
export type ReconciliationIdentity = z.infer<typeof reconciliationIdentitySchema>;
export const reconciliationPayloadSchema = reconciliationIdentitySchema
  .extend({
    rows: z
      .array(
        z
          .object({
            rowId: z.string(),
            selected: z.boolean(),
            mutation: statementMutationSchema,
            chosenCashId: z.guid().nullable(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export const reconciliationPatchSchema = reconciliationPayloadSchema
  .extend({ expectedRevision: z.number().int().positive() })
  .strict();
export const reconciliationSaveSchema = reconciliationIdentitySchema
  .extend({ expectedRevision: z.number().int().positive() })
  .strict();
export type ReconciliationPayload = z.infer<typeof reconciliationPayloadSchema>;
export type ReconciliationView = {
  readonly proposal: ReconciliationProposal;
  readonly revision: number;
  readonly status: "READY" | "STALE" | "EXPIRED" | "DISCARDED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type ReconciliationReceipt = {
  readonly resultId: string;
  readonly alreadyConfirmed: boolean;
};

/** Suggestions never break a tie on arbitrary ordering or fuzzy description score. */
export function suggestedCashId(
  mutation: z.infer<typeof statementMutationSchema>,
  candidates: readonly ReconciliationCandidate[],
): string | null {
  const exact = candidates.filter(
    (c) =>
      c.type === mutation.type &&
      parseNumericToCents(c.amount.toFixed(2)) === parseNumericToCents(mutation.amount.toFixed(2)),
  );
  if (exact.length === 1) return exact[0]?.id ?? null;
  const description = mutation.description.toLocaleLowerCase("id-ID");
  const references = exact.filter(
    (c) =>
      c.reference?.trim() && description.includes(c.reference.trim().toLocaleLowerCase("id-ID")),
  );
  return references.length === 1 ? (references[0]?.id ?? null) : null;
}
export function applyReconciliationReview(
  source: ReconciliationProposal,
  payload: ReconciliationPayload,
): ReconciliationProposal {
  if (
    source.rows.length !== payload.rows.length ||
    new Set(payload.rows.map((r) => r.rowId)).size !== payload.rows.length
  )
    throw new Error("Daftar baris draft tidak sesuai sumber.");
  const used = new Set<string>();
  const rows = source.rows.map((row) => {
    const edit = payload.rows.find((r) => r.rowId === row.rowId);
    if (!edit) throw new Error("Baris draft tidak ditemukan.");
    if (
      source.input.action !== "IMPORT" &&
      JSON.stringify(edit.mutation) !== JSON.stringify(row.mutation)
    )
      throw new Error("Mutasi tersimpan tidak dapat diubah melalui pencocokan.");
    if (row.duplicate && edit.selected) throw new Error("Mutasi duplikat tidak dapat dipilih.");
    if (source.input.action === "MATCH" && edit.chosenCashId !== null) {
      const candidate = row.candidates.find((c) => c.id === edit.chosenCashId);
      if (
        !candidate ||
        candidate.amount !== row.mutation.amount ||
        candidate.type !== row.mutation.type
      )
        throw new Error("Pasangan bukan kandidat dengan nominal/arah yang sama.");
      if (edit.selected && used.has(candidate.id))
        throw new Error("Satu catatan kas hanya dapat dipasangkan sekali.");
      if (edit.selected) used.add(candidate.id);
    }
    if (source.input.action === "MATCH" && edit.selected && !edit.chosenCashId)
      throw new Error("Pilih pasangan untuk mutasi yang ditandai.");
    return { ...row, ...edit };
  });
  return { ...source, rows };
}
