import { z } from "zod";
import { addProjectRapItemSchema, createProjectRapSchema } from "../validations/rap-rab";
import { hasTwoDecimalPrecision, RAP_COST_MAX, RAP_QUANTITY_MAX } from "../project/rap-cost";

export const RAP_DRAFT_KIND = "RAP_MATERIAL_DRAFT";
export const RAP_DRAFT_MAX_ROWS = 50;
export const rapIdSchema = createProjectRapSchema.shape.projectId;
export const rapDraftRowInputSchema = addProjectRapItemSchema
  .omit({ projectRapId: true, name: true, unit: true, source: true })
  .extend({
    materialId: rapIdSchema,
    name: z.string().min(3).max(255).optional(),
    area: z.string().trim().min(2).max(150).default("Umum"),
    estimatedUnitCost: addProjectRapItemSchema.shape.estimatedUnitCost.optional(),
    source: addProjectRapItemSchema.shape.source.optional(),
  })
  .strict();
export const rapDraftInputSchema = z
  .object({
    projectId: rapIdSchema,
    rows: z.array(rapDraftRowInputSchema).min(1).max(RAP_DRAFT_MAX_ROWS),
    notes: z.string().max(1000).optional().nullable(),
  })
  .strict();
export const rapDraftRowSchema = addProjectRapItemSchema.omit({ projectRapId: true }).extend({
  rowId: rapIdSchema,
  materialId: rapIdSchema,
  materialName: z.string(),
  totalQuantity: z.number(),
  estimatedTotalCost: z.number(),
  availableStock: z.number(),
  priceSource: z.enum(["USER", "REFERENCE"]),
  priceSourceLabel: z.string(),
});
export const rapBudgetReviewSchema = z.object({
  categoryId: rapIdSchema,
  categoryName: z.string(),
  allocated: z.number(),
  actual: z.number(),
  pending: z.number(),
  remaining: z.number(),
  existingPlan: z.number(),
  addition: z.number(),
  afterPlan: z.number(),
  overAllocation: z.number(),
});
export const rapDraftProposalSchema = z
  .object({
    kind: z.literal(RAP_DRAFT_KIND),
    projectId: rapIdSchema,
    projectName: z.string(),
    projectRapId: rapIdSchema.nullable(),
    expectedContext: z.string().regex(/^[a-f0-9]{64}$/),
    rows: z.array(rapDraftRowSchema).min(1).max(RAP_DRAFT_MAX_ROWS),
    budget: rapBudgetReviewSchema,
    notes: z.string().max(1000).nullable(),
    stock: z.array(
      z.object({
        materialId: rapIdSchema.optional(),
        materialName: z.string(),
        unit: z.string(),
        planQuantity: z.number(),
        available: z.number(),
        shortage: z.number(),
      }),
    ),
  })
  .strict();
export const rapDraftIdentitySchema = z
  .object({ conversationId: rapIdSchema, toolCallId: z.string().min(1).max(128) })
  .strict();
export const rapDraftFieldsSchema = z
  .object({
    area: z.string().trim().min(2).max(150),
    requiredQuantity: z.number().positive().max(RAP_QUANTITY_MAX).refine(hasTwoDecimalPrecision),
    bufferQuantity: z.number().nonnegative().max(RAP_QUANTITY_MAX).refine(hasTwoDecimalPrecision),
    estimatedUnitCost: z.number().nonnegative().max(RAP_COST_MAX).refine(hasTwoDecimalPrecision),
  })
  .strict();
export const rapDraftRowPatchSchema = z
  .object({ rowId: rapIdSchema, fields: rapDraftFieldsSchema })
  .strict();
export const rapDraftPatchSchema = rapDraftIdentitySchema
  .extend({
    expectedRevision: z.number().int().positive(),
    rows: z.array(rapDraftRowPatchSchema).min(1).max(RAP_DRAFT_MAX_ROWS),
  })
  .strict();
export const rapDraftSaveSchema = rapDraftIdentitySchema
  .extend({
    expectedRevision: z.number().int().positive().optional(),
  })
  .strict();
export const rapReviewPayloadSchema = rapDraftIdentitySchema
  .extend({
    rows: z.array(rapDraftRowPatchSchema).max(RAP_DRAFT_MAX_ROWS),
  })
  .strict();
export const rapDraftViewSchema = z.object({
  proposal: rapDraftProposalSchema,
  status: z.enum(["READY", "STALE", "EXPIRED", "CONFIRMED"]),
  confirmedAt: z.iso.datetime().nullable(),
  draftId: rapIdSchema.nullable().default(null),
  revision: z.number().int().positive().default(1),
});
export type RapDraftFields = z.infer<typeof rapDraftFieldsSchema>;
export type RapDraftRowPatch = z.infer<typeof rapDraftRowPatchSchema>;
export type RapReviewPayload = z.infer<typeof rapReviewPayloadSchema>;
export type RapDraftInput = z.infer<typeof rapDraftInputSchema>;
export type RapDraftProposal = z.infer<typeof rapDraftProposalSchema>;
export type RapDraftView = z.infer<typeof rapDraftViewSchema>;
export type RapDraftRow = z.infer<typeof rapDraftRowSchema>;
export type RapDraftReceipt = {
  readonly projectRapId: string;
  readonly itemIds: readonly string[];
  readonly alreadyConfirmed: boolean;
};
