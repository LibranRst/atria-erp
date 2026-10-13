import { z } from "zod";
import { rapDraftFieldsSchema, rapIdSchema } from "./rap-draft";
import { calculateRapMaterialCost, sumRapAmounts } from "../project/rap-cost";

export const RAP_CHANGE_KIND = "RAP_MATERIAL_CHANGES";
const updateChanges = rapDraftFieldsSchema
  .extend({
    materialId: rapIdSchema.nullable(),
    name: z.string().trim().min(3).max(255),
    unit: z.string().trim().min(1).max(50),
    description: z.string().max(1000).nullable(),
    internalNote: z.string().max(1000).nullable(),
    source: z.enum(["STOCK", "PURCHASE", "STOCK_AND_PURCHASE", "VENDOR"]),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Isi perubahan diperlukan.");
export const rapChangeInputSchema = z
  .object({
    projectId: rapIdSchema,
    rows: z
      .array(
        z.discriminatedUnion("action", [
          z
            .object({ action: z.literal("UPDATE"), itemId: rapIdSchema, changes: updateChanges })
            .strict(),
          z.object({ action: z.literal("DELETE"), itemId: rapIdSchema }).strict(),
        ]),
      )
      .min(1)
      .max(50)
      .refine(
        (rows) => new Set(rows.map((row) => row.itemId)).size === rows.length,
        "Item RAP berulang.",
      ),
  })
  .strict();
export const rapItemSnapshotSchema = rapDraftFieldsSchema
  .extend({
    area: z.string().min(2).max(150),
    itemId: rapIdSchema,
    materialId: rapIdSchema.nullable(),
    name: z.string(),
    unit: z.string(),
    description: z.string().nullable().default(null),
    internalNote: z.string().nullable().default(null),
    source: z.string().default("PURCHASE"),
    totalQuantity: z.number().nonnegative(),
    estimatedTotalCost: z.number().nonnegative(),
  })
  .strict();
const changeRowSchema = z
  .object({
    action: z.enum(["UPDATE", "DELETE"]),
    before: rapItemSnapshotSchema,
    after: rapItemSnapshotSchema.nullable(),
  })
  .strict()
  .refine(
    (row) =>
      row.action === "DELETE"
        ? row.after === null
        : row.after !== null && row.after.itemId === row.before.itemId,
    "Identitas baris tidak boleh berubah.",
  );
export const rapChangeProposalSchema = z
  .object({
    kind: z.literal(RAP_CHANGE_KIND),
    projectId: rapIdSchema,
    projectName: z.string(),
    projectRapId: rapIdSchema,
    expectedContext: z.string().length(64),
    rows: z
      .array(changeRowSchema)
      .min(1)
      .max(50)
      .refine((rows) => new Set(rows.map((row) => row.before.itemId)).size === rows.length),
    budget: z
      .object({
        allocated: z.number(),
        actual: z.number(),
        pending: z.number(),
        remaining: z.number(),
        beforePlan: z.number(),
        afterPlan: z.number(),
        delta: z.number(),
        overAllocation: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();
export const rapChangeIdentitySchema = z
  .object({ conversationId: rapIdSchema, toolCallId: z.string().min(1).max(200) })
  .strict();
export const rapChangeViewSchema = z.object({
  proposal: rapChangeProposalSchema,
  status: z.enum(["READY", "STALE", "EXPIRED", "CONFIRMED"]),
  confirmedAt: z.string().nullable(),
});
export type RapChangeInput = z.infer<typeof rapChangeInputSchema>;
export type RapItemSnapshot = z.infer<typeof rapItemSnapshotSchema>;
export type RapChangeProposal = z.infer<typeof rapChangeProposalSchema>;
export type RapChangeView = z.infer<typeof rapChangeViewSchema>;
export type RapChangeReceipt = {
  readonly projectRapId: string;
  readonly updatedIds: readonly string[];
  readonly deletedIds: readonly string[];
  readonly alreadyConfirmed: boolean;
};

export function buildRapChangeRows(
  input: RapChangeInput,
  items: readonly RapItemSnapshot[],
): RapChangeProposal["rows"] {
  return input.rows.map((change) => {
    const before = items.find((item) => item.itemId === change.itemId);
    if (!before) throw new Error("Item tidak ditemukan pada RAP Draft terbaru proyek ini.");
    if (change.action === "DELETE") return { action: "DELETE", before, after: null };
    const fields = rapItemSnapshotSchema.parse({
      ...before,
      area: before.area,
      requiredQuantity: before.requiredQuantity,
      bufferQuantity: before.bufferQuantity,
      estimatedUnitCost: before.estimatedUnitCost,
      ...change.changes,
    });
    if (change.changes.area === undefined) fields.area = before.area;
    if (
      [
        "area",
        "requiredQuantity",
        "bufferQuantity",
        "estimatedUnitCost",
        "materialId",
        "name",
        "unit",
        "description",
        "internalNote",
        "source",
      ].every((key) => Reflect.get(fields, key) === Reflect.get(before, key))
    )
      throw new Error("Usulan edit tidak mengubah item.");
    const cost = calculateRapMaterialCost(fields);
    return {
      action: "UPDATE",
      before,
      after: {
        ...before,
        ...fields,
        totalQuantity: Number(cost.totalQuantity),
        estimatedTotalCost: Number(cost.estimatedTotalCost),
      },
    };
  });
}
export function rapChangePlanTotals(
  items: readonly RapItemSnapshot[],
  rows: RapChangeProposal["rows"],
): { beforePlan: number; afterPlan: number; delta: number } {
  const beforePlan = Number(sumRapAmounts(items.map((item) => item.estimatedTotalCost.toFixed(2))));
  const afterPlan = Number(
    sumRapAmounts(
      items.flatMap((item) => {
        const change = rows.find((row) => row.before.itemId === item.itemId);
        return change
          ? change.after
            ? [change.after.estimatedTotalCost.toFixed(2)]
            : []
          : [item.estimatedTotalCost.toFixed(2)];
      }),
    ),
  );
  return {
    beforePlan,
    afterPlan,
    delta: Number(sumRapAmounts([afterPlan.toFixed(2), (-beforePlan).toFixed(2)])),
  };
}
