import { z } from "zod";
import { rapIdSchema, rapDraftIdentitySchema } from "./rap-draft";
import {
  hasTwoDecimalPrecision,
  RAP_COST_MAX,
  RAP_QUANTITY_MAX,
  calculateRapMaterialCost,
  sumRapAmounts,
} from "../project/rap-cost";

export const CATEGORY_PLAN_KIND = "CATEGORY_PLAN_PACKAGES";
export const packageCategorySchema = z.enum(["TUKANG", "SUBCON"]);
const quantity = z.number().positive().max(RAP_QUANTITY_MAX).refine(hasTwoDecimalPrecision);
const money = z.number().nonnegative().max(RAP_COST_MAX).refine(hasTwoDecimalPrecision);
export const packageFieldsSchema = z
  .object({
    name: z.string().trim().min(3).max(255),
    scopeDescription: z.string().max(1000).nullable().default(null),
    area: z.string().trim().min(2).max(150),
    quantity,
    unit: z.string().trim().min(1).max(50),
    estimatedUnitCost: money,
    vendorId: rapIdSchema.nullable().default(null),
    internalNote: z.string().max(1000).nullable().default(null),
  })
  .strict();
const manual = packageFieldsSchema.extend({ source: z.literal("MANUAL") }).strict();
const library = z
  .object({
    source: z.literal("LIBRARY"),
    libraryId: rapIdSchema,
    area: z.string().trim().min(2).max(150),
    quantity,
    overrideUnitCost: money.optional(),
    overrideReason: z.string().trim().min(10).max(1000).optional(),
  })
  .strict()
  .refine(
    (v) => v.overrideUnitCost === undefined || Boolean(v.overrideReason),
    "Alasan perubahan harga template wajib diisi.",
  );
export const packageInputSchema = z
  .object({
    projectId: rapIdSchema,
    rows: z
      .array(
        z.discriminatedUnion("action", [
          z
            .object({
              action: z.literal("CREATE"),
              category: packageCategorySchema,
              draft: z.discriminatedUnion("source", [manual, library]),
            })
            .strict(),
          z
            .object({
              action: z.literal("UPDATE"),
              itemId: rapIdSchema,
              changes: z
                .object({
                  name: packageFieldsSchema.shape.name.optional(),
                  scopeDescription: z.string().max(1000).nullable().optional(),
                  area: packageFieldsSchema.shape.area.optional(),
                  quantity: quantity.optional(),
                  unit: packageFieldsSchema.shape.unit.optional(),
                  estimatedUnitCost: money.optional(),
                  vendorId: rapIdSchema.nullable().optional(),
                  internalNote: z.string().max(1000).nullable().optional(),
                })
                .strict()
                .refine((v) => Object.keys(v).length > 0, "Perubahan paket belum diisi."),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(50)
      .refine((rows) => {
        const ids = rows.filter((r) => r.action === "UPDATE").map((r) => r.itemId);
        return new Set(ids).size === ids.length;
      }, "Paket yang sama tidak boleh diubah dua kali."),
  })
  .strict();
export const packageSnapshotSchema = packageFieldsSchema
  .extend({
    name: z.string().min(3).max(255),
    area: z.string().min(2).max(150),
    unit: z.string().min(1).max(50),
    vendorName: z.string().nullable(),
    sourceLibraryItemId: rapIdSchema.nullable(),
    estimatedTotalCost: money,
  })
  .strict();
export const packageProposalSchema = z
  .object({
    kind: z.literal(CATEGORY_PLAN_KIND),
    projectId: rapIdSchema,
    projectName: z.string(),
    projectRapId: rapIdSchema.nullable(),
    expectedContext: z.string().regex(/^[a-f0-9]{64}$/),
    request: packageInputSchema,
    rows: z
      .array(
        z
          .object({
            rowId: rapIdSchema,
            itemId: rapIdSchema.nullable(),
            action: z.enum(["CREATE", "UPDATE"]),
            category: packageCategorySchema,
            before: packageSnapshotSchema.nullable(),
            after: packageSnapshotSchema,
            priceSourceLabel: z.string(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    budgets: z
      .array(
        z
          .object({
            category: packageCategorySchema,
            categoryId: rapIdSchema,
            allocated: z.number(),
            actual: z.number(),
            pending: z.number(),
            remaining: z.number(),
            beforePlan: z.number(),
            afterPlan: z.number(),
            delta: z.number(),
            overAllocation: z.number(),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();
export const packageIdentitySchema = rapDraftIdentitySchema;
export const packageViewSchema = z.object({
  proposal: packageProposalSchema,
  status: z.enum(["READY", "STALE", "EXPIRED", "CONFIRMED"]),
  confirmedAt: z.string().nullable(),
});
export const packageReceiptSchema = z.object({
  items: z.array(
    z.object({ rowId: rapIdSchema, itemId: rapIdSchema, action: z.enum(["CREATE", "UPDATE"]) }),
  ),
  alreadyConfirmed: z.boolean(),
});
export type PackageCategory = z.infer<typeof packageCategorySchema>;
export type PackageFields = z.infer<typeof packageFieldsSchema>;
export type PackageInput = z.infer<typeof packageInputSchema>;
export type PackageSnapshot = z.infer<typeof packageSnapshotSchema>;
export type PackageProposal = z.infer<typeof packageProposalSchema>;
export type PackageView = z.infer<typeof packageViewSchema>;
export type PackageReceipt = z.infer<typeof packageReceiptSchema>;
export function packageCost(fields: Pick<PackageFields, "quantity" | "estimatedUnitCost">): number {
  return Number(
    calculateRapMaterialCost({
      requiredQuantity: fields.quantity,
      bufferQuantity: 0,
      estimatedUnitCost: fields.estimatedUnitCost,
    }).estimatedTotalCost,
  );
}
export function packagePlanTotal(values: readonly number[]): number {
  return sumRapAmounts(values.map((value) => value.toFixed(2)));
}
