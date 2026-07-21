import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const uuidSchema = (message: string) => z.string().regex(uuidRegex, message);

export const createMaterialCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter.").max(100),
  description: z.string().max(500).optional().nullable(),
});

export type CreateMaterialCategoryInput = z.infer<typeof createMaterialCategorySchema>;

export const createMaterialSchema = z.object({
  categoryId: uuidSchema("ID kategori material tidak valid."),
  defaultVendorId: uuidSchema("ID vendor tidak valid.").optional().nullable(),
  name: z.string().min(2, "Nama material minimal 2 karakter.").max(255),
  specification: z.string().max(1000).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  code: z.string().max(100).optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const materialInventoryQuerySchema = z.object({
  search: z.string().max(100).optional(),
  materialId: uuidSchema("ID material tidak valid.").optional(),
  locationId: uuidSchema("ID lokasi tidak valid.").optional(),
});

export type MaterialInventoryQueryInput = z.infer<typeof materialInventoryQuerySchema>;

export const stockMovementBaseSchema = z.object({
  materialId: uuidSchema("ID material tidak valid."),
  inventoryLocationId: uuidSchema("ID lokasi inventory tidak valid."),
  projectId: uuidSchema("ID proyek tidak valid.").optional().nullable(),
  projectRapItemId: uuidSchema("ID item RAP tidak valid.").optional().nullable(),
  projectCostId: uuidSchema("ID biaya proyek tidak valid.").optional().nullable(),
  vendorBillId: uuidSchema("ID tagihan vendor tidak valid.").optional().nullable(),
  quantity: z.number().positive("Kuantitas harus lebih besar dari 0."),
  unitCost: z.number().nonnegative("Harga satuan tidak boleh negatif.").optional(),
  note: z.string().max(500).optional().nullable(),
});

export const recordStockInSchema = stockMovementBaseSchema.extend({
  note: z.string().min(3, "Catatan stock in wajib diisi minimal 3 karakter.").max(500),
});

export type RecordStockInInput = z.infer<typeof recordStockInSchema>;

export const reserveMaterialSchema = stockMovementBaseSchema.extend({
  projectId: uuidSchema("ID proyek wajib valid untuk reservasi."),
  note: z.string().min(3, "Catatan reservasi wajib diisi minimal 3 karakter.").max(500),
});

export type ReserveMaterialInput = z.infer<typeof reserveMaterialSchema>;

export const useMaterialSchema = stockMovementBaseSchema.extend({
  projectId: uuidSchema("ID proyek wajib valid untuk pemakaian material."),
  note: z.string().min(3, "Catatan pemakaian wajib diisi minimal 3 karakter.").max(500),
});

export type UseMaterialInput = z.infer<typeof useMaterialSchema>;

export const returnMaterialSchema = stockMovementBaseSchema.extend({
  projectId: uuidSchema("ID proyek wajib valid untuk pengembalian material."),
  note: z.string().min(3, "Catatan pengembalian wajib diisi minimal 3 karakter.").max(500),
});

export type ReturnMaterialInput = z.infer<typeof returnMaterialSchema>;

export const wasteMaterialSchema = stockMovementBaseSchema.extend({
  projectId: uuidSchema("ID proyek wajib valid untuk waste."),
  note: z.string().min(10, "Waste wajib memiliki catatan audit minimal 10 karakter.").max(500),
});

export type WasteMaterialInput = z.infer<typeof wasteMaterialSchema>;

export const adjustMaterialStockSchema = stockMovementBaseSchema.extend({
  direction: z.enum(["INCREASE", "DECREASE"]),
  note: z.string().min(10, "Adjustment wajib memiliki catatan audit minimal 10 karakter.").max(500),
});

export type AdjustMaterialStockInput = z.infer<typeof adjustMaterialStockSchema>;

export const createInventoryOpeningSchema = z
  .object({
    batchNumber: z.string().trim().min(3).max(100).optional(),
    cutoverDate: z.coerce.date(),
    note: z.string().trim().min(10, "Catatan sumber data minimal 10 karakter.").max(1_000),
    referenceNumber: z.string().trim().max(100).optional().nullable(),
    items: z
      .array(
        z.object({
          materialInventoryId: uuidSchema("ID inventory material tidak valid."),
          quantity: z.number().positive("Quantity awal harus lebih besar dari 0."),
          unitCost: z.number().positive("Average cost awal harus lebih besar dari 0."),
        }),
      )
      .min(1, "Minimal satu item saldo awal stok."),
  })
  .superRefine((value, context) => {
    const ids = value.items.map((item) => item.materialInventoryId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Inventory tidak boleh duplikat.",
      });
  });

export const decideInventoryOpeningSchema = z.object({
  batchId: uuidSchema("ID batch tidak valid."),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter.").max(1_000),
  emergencyOverride: z.boolean().default(false),
});

export const reverseInventoryOpeningSchema = z.object({
  batchId: uuidSchema("ID batch tidak valid."),
  reason: z.string().trim().min(10, "Alasan reversal minimal 10 karakter.").max(1_000),
});

export type CreateInventoryOpeningInput = z.infer<typeof createInventoryOpeningSchema>;
export type DecideInventoryOpeningInput = z.infer<typeof decideInventoryOpeningSchema>;
export type ReverseInventoryOpeningInput = z.infer<typeof reverseInventoryOpeningSchema>;

export const previewInitialStockImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        materialName: z.string().trim().max(255).optional().default(""),
        materialCode: z.string().trim().max(100).optional().default(""),
        locationName: z.string().trim().max(100),
        quantity: z.number(),
        unitCost: z.number(),
      }),
    )
    .min(1, "CSV belum memiliki data."),
});

export type PreviewInitialStockImportInput = z.infer<typeof previewInitialStockImportSchema>;
