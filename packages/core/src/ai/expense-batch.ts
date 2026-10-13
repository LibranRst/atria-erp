import { z } from "zod";
import { expenseDraftPayloadSchema } from "../validations/expense-draft";
import type { PermissionKey } from "../auth/permissions";
export const EXPENSE_BATCH_KIND = "EXPENSE_BATCH",
  EXPENSE_BATCH_ACTION_KIND = "EXPENSE_BATCH_ACTION";
const id = z.string().guid();
const stock = z.enum(["EXPENSE_ONLY", "STOCK_IN", "DIRECT_USE", "RESERVE_FOR_PROJECT"]);
export const expenseBatchModelRowSchema = z
  .object({
    key: z.string().trim().min(1).max(120).optional(),
    projectBudgetCategoryId: id.optional(),
    description: z.string().trim().max(500),
    quantity: z.number().finite().nonnegative().max(999999999).nullable(),
    unitPrice: z.number().finite().nonnegative().max(9999999999999).nullable(),
    amount: z.number().finite().nonnegative().max(9999999999999).nullable(),
    materialId: id.optional(),
    projectRapItemId: id.optional(),
    projectCategoryPlanItemId: id.optional(),
    inventoryLocationId: id.optional(),
    stockHandling: stock.default("EXPENSE_ONLY"),
  })
  .strict();
export const expenseBatchRequestSchema = z
  .object({
    projectId: id.optional(),
    sourceDraftId: id.optional(),
    reviewDraftId: id.optional(),
    expectedRevision: z.number().int().positive().optional(),
    receiptAttachmentId: id.optional(),
    rows: z.array(expenseBatchModelRowSchema).min(1).max(50).optional(),
  })
  .strict()
  .superRefine((r, c) => {
    if (r.sourceDraftId && r.reviewDraftId)
      c.addIssue({ code: "custom", message: "Pilih satu draft sumber." });
    if (!r.sourceDraftId && !r.reviewDraftId && (!r.projectId || !r.rows))
      c.addIssue({ code: "custom", message: "Proyek dan 1–50 baris diperlukan." });
    if (r.reviewDraftId && !r.expectedRevision)
      c.addIssue({ code: "custom", message: "Revision review diperlukan." });
  });
export const expenseBatchIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(180) })
  .strict();
export const expenseBatchProposalSchema = z
  .object({
    kind: z.literal(EXPENSE_BATCH_KIND),
    reviewId: id,
    request: expenseBatchRequestSchema,
    payload: expenseDraftPayloadSchema,
    projectName: z.string(),
    expectedContext: z.string().length(64),
    sourceDraftId: id.nullable(),
    sourceRevision: z.number().int().positive().nullable(),
    expectedReviewRevision: z.number().int().positive().nullable(),
  })
  .strict();
const submitted = z.object({
  key: z.string(),
  costId: id,
  description: z.string(),
  amount: z.number(),
  receiptGroupId: id,
});
export const expenseBatchStateSchema = z
  .object({
    payload: expenseDraftPayloadSchema,
    selectedKeys: z.array(z.string()).max(50),
    submitted: z.array(submitted).max(50),
    contextHash: z.string().length(64),
    sourceDraftId: id.nullable(),
    sourceRevision: z.number().int().positive().nullable(),
    appliedTools: z.array(z.string()).max(1000),
    receipts: z
      .array(
        z.object({
          token: id,
          groupId: id,
          costIds: z.array(id),
          keys: z.array(z.string()),
          total: z.number(),
        }),
      )
      .max(50),
  })
  .strict();
export const expenseBatchPatchSchema = expenseBatchIdentitySchema
  .extend({
    expectedRevision: z.number().int().positive(),
    payload: expenseDraftPayloadSchema,
    selectedKeys: z.array(z.string()).max(50),
  })
  .strict();
export const expenseBatchSubmitSchema = expenseBatchIdentitySchema
  .extend({ expectedRevision: z.number().int().positive(), token: id })
  .strict();
export type ExpenseBatchRequest = z.infer<typeof expenseBatchRequestSchema>;
export type ExpenseBatchProposal = z.infer<typeof expenseBatchProposalSchema>;
export type ExpenseBatchState = z.infer<typeof expenseBatchStateSchema>;
export type ExpenseBatchRow = {
  readonly key: string;
  readonly description: string;
  readonly categoryName: string;
  readonly materialName: string | null;
  readonly unit: string | null;
  readonly locationName: string | null;
  readonly packageName: string | null;
  readonly issues: readonly string[];
  readonly requiresApproval: boolean;
  readonly stockEffect: string;
  readonly stockBefore: number | null;
  readonly stockAfter: number | null;
  readonly reservedBefore: number | null;
  readonly reservedAfter: number | null;
  readonly amount: number;
};
export type ExpenseBatchView = {
  readonly reviewId: string;
  readonly revision: number;
  readonly status: "ACTIVE" | "COMPLETE" | "EXPIRED" | "DISCARDED" | "STALE";
  readonly projectName: string;
  readonly state: ExpenseBatchState;
  readonly rows: readonly ExpenseBatchRow[];
  readonly categories: readonly {
    id: string;
    name: string;
    code: string;
    allocated: number;
    actual: number;
    pending: number;
    proposed: number;
  }[];
  readonly locations: readonly { id: string; name: string }[];
  readonly materials: readonly { id: string; name: string; unit: string }[];
  readonly packages: readonly { id: string; name: string; categoryId: string }[];
  readonly rapItems: readonly { id: string; name: string; materialId: string | null }[];
  readonly canStock: boolean;
  readonly blockers: readonly string[];
  readonly totalSelected: number;
};
export const expenseBatchActionInputSchema = z
  .object({
    action: z.enum(["VERIFY", "APPROVE", "REJECT", "PAY"]),
    projectId: id,
    costIds: z.array(id).min(1).max(50),
    notes: z.string().trim().min(3).max(500).optional(),
    bankAccountId: id.optional(),
    references: z
      .array(z.object({ costId: id, referenceNumber: z.string().trim().min(2).max(100) }).strict())
      .max(50)
      .optional(),
  })
  .strict()
  .superRefine((r, c) => {
    if (new Set(r.costIds).size !== r.costIds.length)
      c.addIssue({ code: "custom", message: "Baris dipilih berulang." });
    if (["APPROVE", "REJECT"].includes(r.action) && !r.notes)
      c.addIssue({ code: "custom", message: "Alasan keputusan diperlukan." });
    if (
      r.action === "PAY" &&
      (!r.bankAccountId ||
        !r.references ||
        r.references.length !== r.costIds.length ||
        new Set(r.references.map((x) => x.referenceNumber)).size !== r.costIds.length ||
        new Set(r.references.map((x) => x.costId)).size !== r.costIds.length ||
        r.references.some((x) => !r.costIds.includes(x.costId)))
    )
      c.addIssue({
        code: "custom",
        message: "Rekening dan referensi bank unik untuk setiap baris diperlukan.",
      });
  });
const fact = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  money: z.boolean(),
});
export const expenseBatchActionProposalSchema = z
  .object({
    kind: z.literal(EXPENSE_BATCH_ACTION_KIND),
    input: expenseBatchActionInputSchema,
    title: z.string(),
    projectName: z.string(),
    expectedContext: z.string().length(64),
    effect: z.string(),
    rows: z
      .array(
        z.object({
          id,
          title: z.string(),
          facts: z.array(fact),
          receipt: z.object({ url: z.string().url(), fileName: z.string() }).nullable().optional(),
        }),
      )
      .max(50),
    summary: z.array(fact),
    budget: z
      .array(
        z.object({
          name: z.string(),
          allocated: z.number(),
          actual: z.number(),
          pending: z.number(),
        }),
      )
      .default([]),
  })
  .strict();
export type ExpenseBatchActionInput = z.infer<typeof expenseBatchActionInputSchema>;
export type ExpenseBatchActionProposal = z.infer<typeof expenseBatchActionProposalSchema>;
export function expenseBatchActionPermissions(
  action: ExpenseBatchActionInput["action"],
): readonly PermissionKey[] {
  return action === "VERIFY"
    ? ["verify:cost", "update:cost"]
    : action === "PAY"
      ? ["pay:cost", "view:bank_account"]
      : ["approve:cost"];
}
