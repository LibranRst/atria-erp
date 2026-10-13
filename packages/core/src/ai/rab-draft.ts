import { z } from "zod";
import { hasTwoDecimalPrecision, RAP_COST_MAX, RAP_QUANTITY_MAX } from "../project/rap-cost";
import { fromCents, parseNumericToCents } from "../finance/money-minor";

export const RAB_DRAFT_KIND = "RAB_DRAFT";
export const rabSourceKindSchema = z.enum(["MATERIAL", "TUKANG", "SUBCON"]);
const quantity = z
  .number()
  .finite()
  .positive()
  .max(RAP_QUANTITY_MAX)
  .refine(hasTwoDecimalPrecision);
const price = z.number().finite().nonnegative().max(RAP_COST_MAX).refine(hasTwoDecimalPrecision);
export const rabClientFieldsSchema = z
  .object({
    clientLabel: z.string().trim().min(3).max(255),
    description: z.string().trim().max(1000),
    quantity,
    unitPrice: price,
  })
  .strict()
  .refine((row) => row.quantity * row.unitPrice <= RAP_COST_MAX, {
    message: "Subtotal melampaui batas nilai RAB.",
  });
export const rabDraftInputSchema = z
  .object({
    projectId: z.string().guid(),
    title: z.string().trim().min(3).max(255).optional(),
    clientNotes: z.string().trim().max(1000).optional(),
    rows: z
      .array(
        z
          .object({
            sourceId: z.string().guid(),
            sourceKind: rabSourceKindSchema,
            clientLabel: z.string().trim().min(3).max(255).optional(),
            description: z.string().trim().max(1000).optional(),
            quantity: quantity.optional(),
            unitPrice: price.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine((input) => new Set(input.rows.map((r) => r.sourceId)).size === input.rows.length, {
    message: "Sumber RAB tidak boleh berulang.",
  });
export const rabDraftRowSchema = rabClientFieldsSchema.safeExtend({
  rowId: z.string().guid(),
  sourceId: z.string().guid(),
  sourceKind: rabSourceKindSchema,
  sourceName: z.string(),
  sourceRevision: z.number().int().positive(),
  unit: z.string().min(1).max(50),
  selected: z.boolean(),
});
export const rabDraftProposalSchema = z
  .object({
    kind: z.literal(RAB_DRAFT_KIND),
    projectId: z.string().guid(),
    projectName: z.string(),
    revision: z.number().int().positive(),
    supersedesId: z.string().guid().nullable(),
    title: z.string().trim().min(3).max(255),
    clientNotes: z.string().trim().max(1000),
    expectedContext: z.string().length(64),
    rows: z.array(rabDraftRowSchema).min(1).max(100),
  })
  .strict()
  .refine((proposal) => rabReviewTotal(proposal.rows) <= RAP_COST_MAX, {
    message: "Total harga jual melampaui batas nilai RAB.",
  });
export const rabDraftIdentitySchema = z
  .object({
    conversationId: z.string().guid(),
    toolCallId: z.string().min(1).max(200),
  })
  .strict();
export const rabDraftPayloadSchema = rabDraftIdentitySchema
  .extend({
    title: z.string().trim().min(3).max(255),
    clientNotes: z.string().trim().max(1000),
    rows: z
      .array(rabClientFieldsSchema.safeExtend({ rowId: z.string().guid(), selected: z.boolean() }))
      .min(1)
      .max(100),
  })
  .strict();
export const rabDraftPatchSchema = rabDraftPayloadSchema
  .extend({
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const rabDraftSaveSchema = rabDraftIdentitySchema
  .extend({
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export type RabDraftInput = z.infer<typeof rabDraftInputSchema>;
export type RabDraftRow = z.infer<typeof rabDraftRowSchema>;
export type RabDraftProposal = z.infer<typeof rabDraftProposalSchema>;
export type RabDraftPayload = z.infer<typeof rabDraftPayloadSchema>;
export type RabDraftView = {
  readonly proposal: RabDraftProposal;
  readonly draftId: string | null;
  readonly revision: number;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly rabEstimateId: string | null;
};
export type RabDraftReceipt = {
  readonly rabEstimateId: string;
  readonly alreadyConfirmed: boolean;
};

export function applyRabReview(
  source: RabDraftProposal,
  payload: RabDraftPayload,
): RabDraftProposal {
  const parsed = rabDraftPayloadSchema.parse(payload);
  if (
    parsed.rows.length !== source.rows.length ||
    new Set(parsed.rows.map((r) => r.rowId)).size !== source.rows.length
  )
    throw new Error("Koreksi harus memuat seluruh baris draft tanpa duplikasi.");
  const patches = new Map(parsed.rows.map((r) => [r.rowId, r]));
  return rabDraftProposalSchema.parse({
    ...source,
    title: parsed.title,
    clientNotes: parsed.clientNotes,
    rows: source.rows.map((row) => {
      const patch = patches.get(row.rowId);
      if (!patch) throw new Error("Baris koreksi bukan bagian dari draft ini.");
      return { ...row, ...patch };
    }),
  });
}
export function rabReviewTotal(rows: readonly RabDraftRow[]): number {
  return Number(
    fromCents(
      rows
        .filter((row) => row.selected)
        .reduce((sum, row) => sum + parseNumericToCents(rabLineTotal(row).toFixed(2)), 0n),
    ),
  );
}
export function rabLineTotal(row: Pick<RabDraftRow, "quantity" | "unitPrice">): number {
  return Number(
    fromCents(
      (parseNumericToCents(row.quantity.toFixed(2)) *
        parseNumericToCents(row.unitPrice.toFixed(2)) +
        50n) /
        100n,
    ),
  );
}
