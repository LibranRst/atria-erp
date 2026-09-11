import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = (message: string): z.ZodString => z.string().regex(uuidRegex, message);

export const createProjectRapSchema = z.object({
  projectId: uuidSchema("ID proyek tidak valid."),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateProjectRapInput = z.infer<typeof createProjectRapSchema>;

export const addProjectRapItemSchema = z.object({
  projectRapId: uuidSchema("ID RAP tidak valid."),
  materialId: uuidSchema("ID material tidak valid.").optional().nullable(),
  area: z.string().min(2, "Area minimal 2 karakter.").max(150),
  name: z.string().min(3, "Nama item minimal 3 karakter.").max(255),
  description: z.string().max(1000).optional().nullable(),
  requiredQuantity: z.number().positive("Kuantitas wajib lebih besar dari 0."),
  bufferQuantity: z.number().min(0, "Buffer tidak boleh negatif.").default(0),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  estimatedUnitCost: z.number().min(0, "Estimasi harga tidak boleh negatif."),
  source: z.enum(["STOCK", "PURCHASE", "STOCK_AND_PURCHASE", "VENDOR"]).default("PURCHASE"),
  internalNote: z.string().max(1000).optional().nullable(),
});

export type AddProjectRapItemInput = z.infer<typeof addProjectRapItemSchema>;

export const updateProjectRapItemSchema = addProjectRapItemSchema.extend({
  projectRapItemId: uuidSchema("ID item RAP tidak valid."),
  projectRapId: uuidSchema("ID RAP tidak valid.").optional(),
});

export type UpdateProjectRapItemInput = z.infer<typeof updateProjectRapItemSchema>;

export const deleteProjectRapItemSchema = z.object({
  projectRapItemId: uuidSchema("ID item RAP tidak valid."),
});

export const lockProjectRapSchema = z.object({
  projectRapId: uuidSchema("ID RAP tidak valid."),
});

export const generateRabFromRapSchema = z.object({
  projectRapId: uuidSchema("ID RAP tidak valid."),
  title: z.string().min(3).max(255).optional(),
  clientNotes: z.string().max(1000).optional().nullable(),
});

export type GenerateRabFromRapInput = z.infer<typeof generateRabFromRapSchema>;

export const rabItemNatureSchema = z.enum(["PRODUCTION", "SERVICE_FEE"]);
export type RabItemNature = z.infer<typeof rabItemNatureSchema>;

const manualRabLineSchema = z.object({
  clientLabel: z.string().min(3, "Label client minimal 3 karakter.").max(255),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().positive("Jumlah wajib lebih besar dari 0."),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  unitPrice: z.number().min(0, "Harga jual tidak boleh negatif."),
  itemNature: rabItemNatureSchema.default("PRODUCTION"),
  isHidden: z.boolean().optional(),
  isBundle: z.boolean().optional(),
});

export const generateRabFromSelectedSourcesSchema = z
  .object({
    projectId: uuidSchema("ID proyek tidak valid."),
    projectRapItemIds: z.array(uuidSchema("ID item RAP tidak valid.")).default([]),
    projectCategoryPlanItemIds: z
      .array(uuidSchema("ID detail plan kategori tidak valid."))
      .default([]),
    selectedBaselineManualItemIds: z
      .array(uuidSchema("ID item manual baseline tidak valid."))
      .optional(),
    manualLines: z.array(manualRabLineSchema).default([]),
    title: z.string().min(3).max(255).optional(),
    clientNotes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (value) =>
      value.projectRapItemIds.length +
        value.projectCategoryPlanItemIds.length +
        (value.selectedBaselineManualItemIds?.length ?? 0) +
        value.manualLines.length >
      0,
    {
      message: "Pilih minimal satu sumber quotation.",
    },
  );

export type GenerateRabFromSelectedSourcesInput = z.infer<
  typeof generateRabFromSelectedSourcesSchema
>;

export const updateRabEstimateItemSchema = z.object({
  rabEstimateItemId: uuidSchema("ID item RAB tidak valid."),
  clientLabel: z.string().min(3, "Label client minimal 3 karakter.").max(255),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().positive("Jumlah wajib lebih besar dari 0."),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  unitPrice: z.number().min(0, "Harga jual tidak boleh negatif."),
  itemNature: rabItemNatureSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
  isHidden: z.boolean().optional(),
  isBundle: z.boolean().optional(),
});

export const addRabManualItemSchema = z.object({
  rabEstimateId: uuidSchema("ID RAB estimate tidak valid."),
  clientLabel: z.string().min(3, "Label client minimal 3 karakter.").max(255),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().positive("Jumlah wajib lebih besar dari 0."),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  unitPrice: z.number().min(0, "Harga jual tidak boleh negatif."),
  itemNature: rabItemNatureSchema.default("PRODUCTION"),
  isHidden: z.boolean().optional(),
  isBundle: z.boolean().optional(),
});

export type AddRabManualItemInput = z.infer<typeof addRabManualItemSchema>;

export type UpdateRabEstimateItemInput = z.infer<typeof updateRabEstimateItemSchema>;

export const approveRabEstimateSchema = z.object({
  rabEstimateId: uuidSchema("ID RAB estimate tidak valid."),
});

export const createRabBundleSchema = z.object({
  rabEstimateId: uuidSchema("ID RAB estimate tidak valid."),
  itemIds: z
    .array(uuidSchema("ID item RAB tidak valid."))
    .min(2, "Pilih minimal dua quotation line."),
  clientLabel: z.string().min(3, "Nama paket minimal 3 karakter.").max(255),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().positive("Jumlah wajib lebih besar dari 0."),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  unitPrice: z.number().nonnegative("Harga paket tidak boleh negatif."),
});

export const updateRabBundleSchema = createRabBundleSchema
  .omit({ rabEstimateId: true, itemIds: true })
  .extend({
    bundleId: uuidSchema("ID paket RAB tidak valid."),
    isHidden: z.boolean().optional(),
  });

export const deleteRabBundleSchema = z.object({
  bundleId: uuidSchema("ID paket RAB tidak valid."),
});

export type CreateRabBundleInput = z.infer<typeof createRabBundleSchema>;
export type UpdateRabBundleInput = z.infer<typeof updateRabBundleSchema>;
