import { z } from "zod";

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "ID tidak valid.",
  );
const money = z.number().finite().nonnegative();
const positiveQuantity = z.number().finite().positive();

export const pricingComponentTypeSchema = z.enum([
  "LABOR",
  "MATERIAL",
  "EQUIPMENT",
  "LOGISTICS",
  "OVERHEAD",
  "OTHER",
]);

export const pricingCostComponentSchema = z.object({
  id: uuid.optional(),
  vendorId: uuid.nullable().optional(),
  componentType: pricingComponentTypeSchema,
  label: z.string().trim().min(2).max(255),
  quantity: positiveQuantity,
  unit: z.string().trim().min(1).max(50),
  unitCost: money,
  note: z.string().trim().max(1000).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const upsertPricingTemplateSchema = z
  .object({
    itemPriceLibraryId: uuid.optional(),
    expenseCategoryId: uuid,
    materialId: uuid.nullable().optional(),
    defaultVendorId: uuid.nullable().optional(),
    code: z.string().trim().max(100).nullable().optional(),
    itemType: z.enum(["MATERIAL_ITEM", "WORK_PACKAGE", "SUBCON_PACKAGE", "CLIENT_LINE"]),
    itemCategory: z.string().trim().min(2).max(120),
    name: z.string().trim().min(2).max(255),
    description: z.string().trim().max(1000).nullable().optional(),
    unit: z.string().trim().min(1).max(50),
    pricingMode: z.enum(["MARGIN_BASED", "FIXED_CLIENT_PRICE"]),
    targetGrossPercentage: z.number().finite().min(0).max(0.95),
    fixedClientPrice: money.optional(),
    priceSourceType: z.enum(["COST_BREAKDOWN", "VENDOR_QUOTE", "HISTORICAL", "LEGACY_BACKFILL"]),
    sourceNote: z.string().trim().min(3).max(2000),
    effectiveFrom: z.coerce.date(),
    isActive: z.boolean().optional(),
    components: z
      .array(pricingCostComponentSchema)
      .min(1, "Minimal satu komponen biaya wajib diisi."),
  })
  .superRefine((value, context) => {
    if (value.pricingMode === "FIXED_CLIENT_PRICE" && value.fixedClientPrice === undefined) {
      context.addIssue({
        code: "custom",
        path: ["fixedClientPrice"],
        message: "Harga client wajib diisi untuk mode fixed.",
      });
    }
    if (value.itemType !== "MATERIAL_ITEM" && value.materialId) {
      context.addIssue({
        code: "custom",
        path: ["materialId"],
        message: "Material hanya dapat ditautkan ke Material Item.",
      });
    }
  });

export type UpsertPricingTemplateInput = z.infer<typeof upsertPricingTemplateSchema>;

export const copyTemplateToRapSchema = z
  .object({
    projectRapId: uuid,
    itemPriceLibraryId: uuid,
    area: z.string().trim().min(1).max(150),
    requiredQuantity: positiveQuantity,
    bufferQuantity: z.number().finite().nonnegative(),
    source: z.enum(["STOCK", "PURCHASE", "STOCK_AND_PURCHASE", "VENDOR"]),
    overrideUnitCost: money.optional(),
    overrideReason: z.string().trim().min(10).max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.overrideUnitCost !== undefined && !value.overrideReason) {
      context.addIssue({
        code: "custom",
        path: ["overrideReason"],
        message: "Alasan override harga wajib diisi.",
      });
    }
  });

export const copyTemplateToCategoryPlanSchema = z
  .object({
    projectId: uuid,
    projectBudgetCategoryId: uuid,
    itemPriceLibraryId: uuid,
    area: z.string().trim().min(1).max(150),
    quantity: positiveQuantity,
    overrideUnitCost: money.optional(),
    overrideReason: z.string().trim().min(10).max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.overrideUnitCost !== undefined && !value.overrideReason) {
      context.addIssue({
        code: "custom",
        path: ["overrideReason"],
        message: "Alasan override harga wajib diisi.",
      });
    }
  });

export const reallocateProjectBudgetSchema = z
  .object({
    projectBudgetId: uuid,
    reason: z.string().trim().max(1000).optional(),
    categories: z
      .array(
        z.object({
          projectBudgetCategoryId: uuid,
          ratioPercentage: z.number().finite().min(0).max(1),
        }),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    const ids = value.categories.map((category) => category.projectBudgetCategoryId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Kategori tidak boleh duplikat.",
      });
    }
    const total = value.categories.reduce((sum, category) => sum + category.ratioPercentage, 0);
    if (total > 1.000001) {
      context.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Total alokasi tidak boleh melebihi 100%.",
      });
    }
  });

export const createRapRevisionSchema = z.object({
  projectRapId: uuid,
  reason: z.string().trim().min(10).max(1000),
});
export const createCategoryPlanRevisionSchema = z.object({
  projectCategoryPlanItemId: uuid,
  reason: z.string().trim().min(10).max(1000),
});
export const refreshRabSourcesSchema = z.object({ rabEstimateId: uuid });
export const createChangeOrderSchema = z.object({
  baseRabEstimateId: uuid,
  revisedRabEstimateId: uuid,
  reason: z.string().trim().min(10).max(2000),
  scopeSummary: z.string().trim().min(10).max(4000),
});
export const confirmChangeOrderClientSchema = z.object({
  changeOrderId: uuid,
  confirmedAt: z.coerce.date(),
  confirmationReference: z.string().trim().min(3).max(255),
});
export const approveChangeOrderSchema = z.object({
  changeOrderId: uuid,
  emergencyOverride: z.boolean().default(false),
  reason: z.string().trim().min(10).max(1000).optional(),
});
export const voidRabRevisionSchema = z.object({
  rabEstimateId: uuid,
  reason: z.string().trim().min(3, "Alasan pembatalan minimal 3 karakter.").max(1000),
});
export const rapSetupStageSchema = z.enum(["MATERIAL", "TUKANG", "SUBCON", "REVIEW", "COMPLETE"]);
export const advanceProjectRapSetupSchema = z.object({
  projectRapId: uuid,
  targetStage: rapSetupStageSchema.exclude(["MATERIAL", "COMPLETE"]),
});
export const setProjectRapScopeSkippedSchema = z.object({
  projectRapId: uuid,
  categoryCode: z.enum(["TUKANG", "SUBCON"]),
  skipped: z.boolean(),
});
export const markProjectCategoryPlanItemDraftSchema = z.object({ projectCategoryPlanItemId: uuid });
export const finalizeProjectInternalPlanSchema = z.object({ projectRapId: uuid });
export const createInternalPlanRevisionSchema = z
  .object({
    projectRapId: uuid,
    reason: z.string().trim().min(10).max(1000),
    includeMaterial: z.boolean(),
    packageItemIds: z.array(uuid),
  })
  .refine(
    (value) => value.includeMaterial || value.packageItemIds.length > 0,
    "Pilih minimal satu scope perubahan.",
  );
export const completeProjectSchema = z.object({
  projectId: uuid,
  closingNote: z.string().trim().min(10).max(2000),
});

export const createGoodsReceiptSchema = z
  .object({
    vendorBillId: uuid.nullable().optional(),
    projectId: uuid,
    inventoryLocationId: uuid,
    receiptNumber: z.string().trim().min(3).max(100),
    receivedAt: z.coerce.date(),
    note: z.string().trim().max(2000).nullable().optional(),
    items: z
      .array(
        z.object({
          materialId: uuid,
          projectRapItemId: uuid.nullable().optional(),
          quantity: positiveQuantity,
          unitCost: money,
          note: z.string().trim().max(1000).nullable().optional(),
        }),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    const keys = value.items.map(
      (item) => `${item.materialId}:${item.projectRapItemId ?? "manual"}`,
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Material dan item RAP yang sama tidak boleh diulang dalam satu penerimaan.",
      });
    }
  });

export const generateInvoiceScheduleSchema = z
  .object({
    projectId: uuid,
    firstDueDate: z.coerce.date(),
    installments: z
      .array(
        z.object({
          label: z.string().trim().min(2).max(120),
          percentage: z.number().finite().positive().max(1),
        }),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    const total = value.installments.reduce((sum, installment) => sum + installment.percentage, 0);
    if (Math.abs(total - 1) > 0.000001) {
      context.addIssue({
        code: "custom",
        path: ["installments"],
        message: "Total termin invoice harus tepat 100%.",
      });
    }
  });
