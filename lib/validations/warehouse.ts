import { z } from "zod";

const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "ID tidak valid.");
const positive = z.number().finite().positive();

export const createStockTransferSchema = z.object({
  transferNumber: z.string().trim().min(3).max(100),
  fromLocationId: uuid,
  toLocationId: uuid,
  transferredAt: z.coerce.date(),
  note: z.string().trim().min(10).max(1000),
  items: z.array(z.object({ materialId: uuid, quantity: positive })).min(1),
}).superRefine((value, context) => {
  if (value.fromLocationId === value.toLocationId) context.addIssue({ code: "custom", path: ["toLocationId"], message: "Lokasi tujuan harus berbeda." });
  if (new Set(value.items.map((item) => item.materialId)).size !== value.items.length) context.addIssue({ code: "custom", path: ["items"], message: "Material transfer tidak boleh duplikat." });
});

export const saveStockCountSchema = z.object({
  stockCountId: uuid.optional(),
  countNumber: z.string().trim().min(3).max(100),
  inventoryLocationId: uuid,
  countedAt: z.coerce.date(),
  note: z.string().trim().max(1000).optional().nullable(),
  items: z.array(z.object({ materialId: uuid, countedQuantity: z.number().finite().nonnegative() })).min(1),
});
export const stockCountIdSchema = z.object({ stockCountId: uuid });
export const rejectStockCountSchema = stockCountIdSchema.extend({ reason: z.string().trim().min(10).max(1000) });

export const receiptReversalRequestSchema = z.object({ goodsReceiptId: uuid, reason: z.string().trim().min(10).max(1000) });
export const receiptReversalDecisionSchema = z.object({ goodsReceiptId: uuid, reason: z.string().trim().min(10).max(1000).optional() });

export const emergencyAdjustmentSchema = z.object({ materialId: uuid, inventoryLocationId: uuid, direction: z.enum(["INCREASE", "DECREASE"]), quantity: positive, note: z.string().trim().min(10).max(500) });
export const createInventoryLocationSchema = z.object({ name: z.string().trim().min(3).max(100), description: z.string().trim().max(500).optional().nullable() });
export const movementPageSchema = z.object({ cursor: z.coerce.date().optional(), limit: z.number().int().min(10).max(100).default(30) });

export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
export type SaveStockCountInput = z.infer<typeof saveStockCountSchema>;
