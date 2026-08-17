import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = (message: string): z.ZodString => z.string().regex(uuidRegex, message);

export const projectCategoryPlanItemStatusSchema = z.enum(["DRAFT", "ACTIVE", "DONE", "CANCELLED"]);

export const createProjectCategoryPlanItemSchema = z.object({
  projectId: uuidSchema("ID proyek tidak valid."),
  projectBudgetCategoryId: uuidSchema("ID kategori budget proyek tidak valid."),
  vendorId: uuidSchema("ID vendor tidak valid.").optional().nullable(),
  name: z.string().min(3, "Nama paket minimal 3 karakter.").max(255),
  scopeDescription: z.string().max(1000).optional().nullable(),
  area: z.string().min(2, "Area minimal 2 karakter.").max(150).default("Umum"),
  quantity: z.number().positive("Jumlah wajib lebih besar dari 0."),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  estimatedUnitCost: z.number().min(0, "Estimasi biaya tidak boleh negatif."),
  internalNote: z.string().max(1000).optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
});

export type CreateProjectCategoryPlanItemInput = z.infer<
  typeof createProjectCategoryPlanItemSchema
>;

export const updateProjectCategoryPlanItemSchema = createProjectCategoryPlanItemSchema.extend({
  projectCategoryPlanItemId: uuidSchema("ID detail plan kategori tidak valid."),
  status: projectCategoryPlanItemStatusSchema.optional(),
});

export type UpdateProjectCategoryPlanItemInput = z.infer<
  typeof updateProjectCategoryPlanItemSchema
>;

export const deleteProjectCategoryPlanItemSchema = z.object({
  projectCategoryPlanItemId: uuidSchema("ID detail plan kategori tidak valid."),
});

export const markProjectCategoryPlanItemActiveSchema = z.object({
  projectCategoryPlanItemId: uuidSchema("ID detail plan kategori tidak valid."),
});
