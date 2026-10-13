import { z } from "zod";
export const BUDGET_SYNC_KIND = "BUDGET_SYNC";
const id = z.string().guid();
const amount = z.string().regex(/^-?\d+\.\d{2}$/);
export const budgetSyncInputSchema = z.object({ projectId: id }).strict();
export const budgetSyncIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export const budgetUsageSummarySchema = z
  .object({
    pendingAmount: amount,
    actualAmount: amount,
    paidAmount: amount,
    remainingAmount: amount,
    usedPercentage: z.string().regex(/^\d+\.\d{4}$/),
    status: z.enum(["SAFE", "WATCH", "CRITICAL", "OVER_BUDGET"]),
  })
  .strict();
export const budgetSyncProposalSchema = z
  .object({
    kind: z.literal(BUDGET_SYNC_KIND),
    input: budgetSyncInputSchema,
    projectBudgetId: id,
    projectName: z.string(),
    expectedContext: z.string().length(64),
    internalBudget: amount,
    categories: z
      .array(
        z
          .object({
            id,
            name: z.string(),
            allocatedAmount: amount,
            before: budgetUsageSummarySchema,
            after: budgetUsageSummarySchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export type BudgetSyncProposal = z.infer<typeof budgetSyncProposalSchema>;
export type BudgetSyncInput = z.infer<typeof budgetSyncInputSchema>;
export type BudgetSyncView = {
  readonly proposal: BudgetSyncProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly verified: boolean;
  readonly confirmedAt: string | null;
};
export const budgetSummaryFields = [
  ["pendingAmount", "Menunggu persetujuan", true],
  ["actualAmount", "Terpakai", true],
  ["paidAmount", "Dibayar", true],
  ["remainingAmount", "Sisa alokasi", true],
  ["usedPercentage", "Pemakaian", false],
  ["status", "Kondisi budget", false],
] as const;
export function budgetSummaryChanges(
  row: BudgetSyncProposal["categories"][number],
): readonly (typeof budgetSummaryFields)[number][] {
  return budgetSummaryFields.filter(([key]) => row.before[key] !== row.after[key]);
}
