import { z } from "zod";
import { rapIdSchema } from "./rap-draft";
import { setupProposalSchema, setupIdentitySchema } from "./rap-finalization";
import { addProjectRapItemSchema } from "../validations/rap-rab";
import { copyTemplateToRapSchema } from "../validations/workflow-governance";
export const lifecycleMaterialInputSchema = z.discriminatedUnion("sourceKind", [
  addProjectRapItemSchema
    .omit({ projectRapId: true })
    .extend({ sourceKind: z.literal("MANUAL") })
    .strict(),
  z
    .object(copyTemplateToRapSchema.shape)
    .omit({ projectRapId: true })
    .extend({ sourceKind: z.literal("LIBRARY") })
    .strict()
    .refine(
      (v) => v.overrideUnitCost === undefined || (v.overrideReason?.trim().length ?? 0) >= 10,
      "Override harga memerlukan alasan10 karakter.",
    ),
]);

const packageIds = z
  .array(rapIdSchema)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "Paket berulang.");
export const lifecycleInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("ADD_MATERIAL"),
      projectId: rapIdSchema,
      rows: z.array(lifecycleMaterialInputSchema).min(1).max(50),
    })
    .strict(),
  z
    .object({
      action: z.literal("REVISION"),
      projectId: rapIdSchema,
      reason: z.string().trim().min(10).max(1000),
      reviseMaterial: z.boolean(),
      packageIds,
    })
    .strict()
    .refine((v) => v.reviseMaterial || v.packageIds.length > 0, "Pilih bagian revisi."),
  z
    .object({
      action: z.literal("PACKAGE_CHANGES"),
      projectId: rapIdSchema,
      rows: z
        .array(z.object({ itemId: rapIdSchema, action: z.enum(["REOPEN", "DELETE"]) }).strict())
        .min(1)
        .max(50)
        .refine(
          (rows) => new Set(rows.map((r) => r.itemId)).size === rows.length,
          "Paket berulang.",
        ),
    })
    .strict(),
]);
export const lifecycleRowSchema = z
  .object({
    id: rapIdSchema,
    action: z.enum(["REVISION", "REOPEN", "DELETE", "ADD"]),
    category: z.enum(["MATERIAL", "TUKANG", "SUBCON"]),
    name: z.string(),
    detail: z.string(),
    beforeStatus: z.enum(["DRAFT", "ACTIVE", "LOCKED", "NEW"]),
    afterStatus: z.enum(["DRAFT", "DELETED"]),
    estimate: z.number().nonnegative(),
    revision: z.number().int().positive(),
    nextId: rapIdSchema.nullable(),
  })
  .strict();
export const lifecycleProposalSchema = z
  .object({
    kind: z.literal("RAP_LIFECYCLE"),
    projectId: rapIdSchema,
    projectName: z.string(),
    projectRapId: rapIdSchema,
    expectedContext: z.string().length(64),
    request: lifecycleInputSchema,
    nextRapId: rapIdSchema.nullable(),
    rows: z.array(lifecycleRowSchema).min(1).max(51),
    budget: setupProposalSchema.shape.budget,
    materialRows: z
      .array(
        z
          .object({
            rowId: rapIdSchema,
            values: addProjectRapItemSchema,
            libraryId: rapIdSchema.nullable(),
            clientUnitPrice: z.string().nullable(),
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict();
export const lifecycleIdentitySchema = setupIdentitySchema;
export const lifecycleViewSchema = z.object({
  proposal: lifecycleProposalSchema,
  status: z.enum(["READY", "STALE", "EXPIRED", "CONFIRMED"]),
  confirmedAt: z.string().nullable(),
});
export type LifecycleInput = z.infer<typeof lifecycleInputSchema>;
export type LifecycleProposal = z.infer<typeof lifecycleProposalSchema>;
export type LifecycleView = z.infer<typeof lifecycleViewSchema>;
export type LifecycleReceipt = {
  readonly projectRapId: string;
  readonly addedIds: readonly string[];
  readonly revisionIds: readonly string[];
  readonly reopenedIds: readonly string[];
  readonly deletedIds: readonly string[];
  readonly alreadyConfirmed: boolean;
};
export function lifecyclePermissions(
  input: LifecycleInput,
): readonly ("update:rap" | "update:budget" | "view:material")[] {
  if (input.action === "ADD_MATERIAL") return ["update:rap", "view:material"];
  return input.action === "REVISION"
    ? input.packageIds.length
      ? ["update:rap", "update:budget"]
      : ["update:rap"]
    : ["update:budget"];
}
