import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = (message: string) => z.string().regex(uuidRegex, message);

export const updateBudgetAllocationSettingSchema = z.object({
  budgetAllocationSettingId: uuidSchema("ID setting budget tidak valid."),
  name: z.string().min(3, "Nama setting minimal 3 karakter.").max(120),
  budgetCapRatio: z.number().min(0, "Budget cap tidak boleh negatif.").max(1, "Budget cap maksimal 100%."),
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdateBudgetAllocationSettingInput = z.infer<typeof updateBudgetAllocationSettingSchema>;

export const updateBudgetAllocationCategoryRatioSchema = z.object({
  budgetAllocationSettingCategoryId: uuidSchema("ID kategori allocation tidak valid."),
  ratioPercentage: z.number().min(0, "Ratio tidak boleh negatif.").max(1, "Ratio maksimal 100%."),
  isEnabled: z.boolean(),
});

export type UpdateBudgetAllocationCategoryRatioInput = z.infer<typeof updateBudgetAllocationCategoryRatioSchema>;

const budgetAllocationCategoryInputSchema = z.object({
  budgetAllocationSettingCategoryId: uuidSchema("ID kategori allocation tidak valid."),
  ratioPercentage: z.number().min(0, "Ratio tidak boleh negatif.").max(1, "Ratio maksimal 100%."),
  isEnabled: z.boolean(),
});

export const updateBudgetAllocationDefaultsSchema = z.object({
  budgetAllocationSettingId: uuidSchema("ID setting budget tidak valid."),
  name: z.string().min(3, "Nama setting minimal 3 karakter.").max(120),
  budgetCapRatio: z.number().min(0, "Budget cap tidak boleh negatif.").max(1, "Budget cap maksimal 100%."),
  notes: z.string().max(1000).optional().nullable(),
  categories: z.array(budgetAllocationCategoryInputSchema).min(1, "Kategori budget wajib tersedia."),
}).superRefine((value, context) => {
  const ids = value.categories.map((category) => category.budgetAllocationSettingCategoryId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["categories"], message: "Kategori budget tidak boleh duplikat." });
  }

  const activeTotal = value.categories.reduce(
    (total, category) => total + (category.isEnabled ? category.ratioPercentage : 0),
    0,
  );
  if (activeTotal > 1.000001) {
    context.addIssue({ code: "custom", path: ["categories"], message: "Total alokasi kategori aktif tidak boleh melebihi 100%." });
  }
});

export type UpdateBudgetAllocationDefaultsInput = z.infer<typeof updateBudgetAllocationDefaultsSchema>;

export const updateExpenseCategorySettingSchema = z.object({
  expenseCategoryId: uuidSchema("ID kategori expense tidak valid."),
  name: z.string().min(2, "Nama kategori minimal 2 karakter.").max(100),
  description: z.string().max(500).optional().nullable(),
  defaultRatio: z.number().min(0, "Default ratio tidak boleh negatif.").max(1, "Default ratio maksimal 100%."),
  isActive: z.boolean(),
});

export type UpdateExpenseCategorySettingInput = z.infer<typeof updateExpenseCategorySettingSchema>;

export const updateExpenseCategoryDetailsSchema = z.object({
  expenseCategoryId: uuidSchema("ID kategori expense tidak valid."),
  name: z.string().min(2, "Nama kategori minimal 2 karakter.").max(100),
  description: z.string().max(500).optional().nullable(),
});

export type UpdateExpenseCategoryDetailsInput = z.infer<typeof updateExpenseCategoryDetailsSchema>;

export const itemLibraryTypeSchema = z.enum(["MATERIAL_ITEM", "WORK_PACKAGE", "SUBCON_PACKAGE", "CLIENT_LINE"]);

export const createItemPriceLibraryItemSchema = z.object({
  expenseCategoryId: uuidSchema("ID kategori expense tidak valid."),
  materialId: uuidSchema("ID material tidak valid.").optional().nullable(),
  code: z.string().max(100).optional().nullable(),
  itemType: itemLibraryTypeSchema,
  itemCategory: z.string().min(2, "Kategori item minimal 2 karakter.").max(120),
  name: z.string().min(2, "Nama item minimal 2 karakter.").max(255),
  description: z.string().max(1000).optional().nullable(),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  defaultClientPrice: z.number().nonnegative("Harga client tidak boleh negatif."),
  defaultInternalCost: z.number().nonnegative("Biaya internal tidak boleh negatif."),
});

export type CreateItemPriceLibraryItemInput = z.infer<typeof createItemPriceLibraryItemSchema>;

export const updateItemPriceLibraryItemSchema = createItemPriceLibraryItemSchema.extend({
  itemPriceLibraryId: uuidSchema("ID item library tidak valid."),
  isActive: z.boolean(),
});

export type UpdateItemPriceLibraryItemInput = z.infer<typeof updateItemPriceLibraryItemSchema>;

export const archiveItemPriceLibraryItemSchema = z.object({
  itemPriceLibraryId: uuidSchema("ID item library tidak valid."),
});

export type ArchiveItemPriceLibraryItemInput = z.infer<typeof archiveItemPriceLibraryItemSchema>;

export const setItemPriceLibraryItemActiveSchema = z.object({
  itemPriceLibraryId: uuidSchema("ID item library tidak valid."),
  isActive: z.boolean(),
});

export type SetItemPriceLibraryItemActiveInput = z.infer<typeof setItemPriceLibraryItemActiveSchema>;

export const getItemPriceLibrarySchema = z.object({
  search: z.string().max(100).optional(),
  expenseCategoryId: uuidSchema("ID kategori expense tidak valid.").optional(),
  itemType: itemLibraryTypeSchema.optional(),
  includeInactive: z.boolean().optional(),
});

export type GetItemPriceLibraryInput = z.infer<typeof getItemPriceLibrarySchema>;

export const updateMaterialSchema = z.object({
  materialId: uuidSchema("ID material tidak valid."),
  categoryId: uuidSchema("ID kategori material tidak valid."),
  defaultVendorId: uuidSchema("ID vendor tidak valid.").optional().nullable(),
  name: z.string().min(2, "Nama material minimal 2 karakter.").max(255),
  specification: z.string().max(1000).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  code: z.string().max(100).optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
  isActive: z.boolean(),
});

export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const updateMaterialInventoryDefaultsSchema = z.object({
  materialInventoryId: uuidSchema("ID inventory material tidak valid."),
  minimumStock: z.number().nonnegative("Minimum stock tidak boleh negatif."),
  averageCost: z.number().nonnegative("Average cost tidak boleh negatif."),
  lastPurchasePrice: z.number().nonnegative("Last purchase price tidak boleh negatif."),
});

export type UpdateMaterialInventoryDefaultsInput = z.infer<typeof updateMaterialInventoryDefaultsSchema>;

const materialIdentitySchema = z.object({
  categoryId: uuidSchema("ID kategori material tidak valid."),
  defaultVendorId: uuidSchema("ID vendor tidak valid.").optional().nullable(),
  name: z.string().min(2, "Nama material minimal 2 karakter.").max(255),
  specification: z.string().max(1000).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  code: z.string().max(100).optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
});

export const createMaterialWithInventoryDefaultsSchema = materialIdentitySchema.extend({
  inventoryDefaults: z.array(z.object({
    inventoryLocationId: uuidSchema("ID lokasi inventory tidak valid."),
    minimumStock: z.number().nonnegative("Minimum stock tidak boleh negatif."),
    lastPurchasePrice: z.number().nonnegative("Harga referensi tidak boleh negatif."),
  })).min(1, "Pilih minimal satu lokasi inventory."),
}).superRefine((value, context) => {
  const ids = value.inventoryDefaults.map((inventory) => inventory.inventoryLocationId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["inventoryDefaults"], message: "Lokasi inventory tidak boleh duplikat." });
  }
});

export type CreateMaterialWithInventoryDefaultsInput = z.infer<typeof createMaterialWithInventoryDefaultsSchema>;

export const updateMaterialSettingDefaultsSchema = z.object({
  materialInventoryId: uuidSchema("ID inventory material tidak valid."),
  minimumStock: z.number().nonnegative("Minimum stock tidak boleh negatif."),
  lastPurchasePrice: z.number().nonnegative("Harga referensi tidak boleh negatif."),
});

export type UpdateMaterialSettingDefaultsInput = z.infer<typeof updateMaterialSettingDefaultsSchema>;

export const archiveMaterialSchema = z.object({
  materialId: uuidSchema("ID material tidak valid."),
});

export type ArchiveMaterialInput = z.infer<typeof archiveMaterialSchema>;

export const setMaterialActiveSchema = z.object({
  materialId: uuidSchema("ID material tidak valid."),
  isActive: z.boolean(),
});

export type SetMaterialActiveInput = z.infer<typeof setMaterialActiveSchema>;

export const createMaterialCategorySettingSchema = z.object({
  name: z.string().min(2, "Nama kategori material minimal 2 karakter.").max(100),
  description: z.string().max(500).optional().nullable(),
});

export type CreateMaterialCategorySettingInput = z.infer<typeof createMaterialCategorySettingSchema>;
