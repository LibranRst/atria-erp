import { z } from "zod";
import { parseNumericToCents } from "../finance/money-minor";
import type { PermissionKey } from "../auth/permissions";

export const PROCUREMENT_WAREHOUSE_KIND = "PROCUREMENT_WAREHOUSE";
const id = z.string().guid();
export const stockQuantitySchema = z
  .number()
  .finite()
  .nonnegative()
  .max(9_999_999_999.99)
  .refine((v: number): boolean => Number(v.toFixed(2)) === v, "Maksimal dua desimal.");
export const invoiceMoneySchema = z
  .number()
  .finite()
  .nonnegative()
  .max(9_999_999_999_999.99)
  .refine((v: number): boolean => Number(v.toFixed(2)) === v, "Maksimal dua desimal.");
const date = z.iso.date();
export const invoiceLineSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    quantity: stockQuantitySchema.positive(),
    unit: z.string().trim().min(1).max(30),
    amount: z
      .number()
      .finite()
      .min(-9_999_999_999_999.99)
      .max(9_999_999_999_999.99)
      .refine((v) => Number(v.toFixed(2)) === v, "Maksimal dua desimal."),
    source: z.string().trim().max(255).default("Percakapan"),
  })
  .strict();
export const invoiceSourceSchema = z
  .object({
    urls: z.array(z.string().url()).max(4).default([]),
    lines: z.array(invoiceLineSchema).max(100).default([]),
  })
  .strict();
export const billProposalPayloadSchema = z
  .object({
    vendorId: id,
    projectId: id,
    projectBudgetCategoryId: id,
    projectCategoryPlanItemId: id.nullable().default(null),
    materialId: id.nullable().default(null),
    projectRapItemId: id.nullable().default(null),
    billNumber: z.string().trim().min(1).max(100),
    amount: invoiceMoneySchema.positive(),
    dueDate: date,
    notes: z.string().trim().max(500).default(""),
    invoice: invoiceSourceSchema.default({ urls: [], lines: [] }),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.invoice.lines.length &&
      v.invoice.lines.reduce((sum, row) => sum + parseNumericToCents(row.amount.toFixed(2)), 0n) !==
        parseNumericToCents(v.amount.toFixed(2))
    )
      ctx.addIssue({
        code: "custom",
        path: ["invoice", "lines"],
        message:
          "Total rincian harus sama dengan nominal tagihan; tampilkan pajak/diskon sebagai rincian yang jelas.",
      });
    if (v.projectRapItemId && !v.materialId)
      ctx.addIssue({
        code: "custom",
        path: ["materialId"],
        message: "Pilih material untuk tautan RAP.",
      });
  });
const unique = <T extends { materialId: string }>(
  v: { items: T[] },
  ctx: z.RefinementCtx,
): void => {
  if (new Set(v.items.map((i) => i.materialId)).size !== v.items.length)
    ctx.addIssue({ code: "custom", path: ["items"], message: "Material tidak boleh berulang." });
};
const transfer = z
  .object({
    action: z.literal("WAREHOUSE_TRANSFER"),
    transferNumber: z.string().trim().min(3).max(100),
    fromLocationId: id,
    toLocationId: id,
    transferredAt: date,
    note: z.string().trim().min(10).max(1000),
    items: z
      .array(z.object({ materialId: id, quantity: stockQuantitySchema.positive() }).strict())
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine(unique)
  .superRefine((v, ctx) => {
    if (v.fromLocationId === v.toLocationId)
      ctx.addIssue({
        code: "custom",
        path: ["toLocationId"],
        message: "Lokasi tujuan harus berbeda.",
      });
  });
const count = z
  .object({
    action: z.literal("STOCK_COUNT_SAVE"),
    stockCountId: id.optional(),
    countNumber: z.string().trim().min(3).max(100),
    inventoryLocationId: id,
    countedAt: date,
    note: z.string().trim().min(10).max(1000),
    items: z
      .array(z.object({ materialId: id, countedQuantity: stockQuantitySchema }).strict())
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine(unique);
const receiptId = z.string().guid();
export const receiptReversalInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("RECEIPT_REVERSAL_REQUEST"),
      goodsReceiptId: receiptId,
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
  z.object({ action: z.literal("RECEIPT_REVERSAL_APPROVE"), goodsReceiptId: receiptId }).strict(),
  z
    .object({
      action: z.literal("RECEIPT_REVERSAL_REJECT"),
      goodsReceiptId: receiptId,
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
]);
export type ReceiptReversalInput = z.infer<typeof receiptReversalInputSchema>;
const intakeItems = z
  .array(
    z
      .object({
        materialId: id,
        quantity: stockQuantitySchema.positive(),
        unitCost: invoiceMoneySchema,
        projectRapItemId: id.optional(),
        note: z.string().trim().max(500).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(100);
export const warehouseIntakeInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("PROJECT_RECEIPT"),
      projectId: id,
      inventoryLocationId: id,
      receiptNumber: z.string().trim().min(3).max(100),
      receivedAt: date,
      vendorBillId: id.optional(),
      note: z.string().trim().min(10).max(500),
      items: intakeItems,
    })
    .strict()
    .superRefine((value, ctx) => {
      const keys = value.items.map(
        (item) => `${item.materialId}:${item.projectRapItemId ?? "manual"}`,
      );
      if (new Set(keys).size !== keys.length)
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: "Material dan item RAP yang sama tidak boleh berulang.",
        });
    }),
  z
    .object({
      action: z.literal("WAREHOUSE_STOCK_IN"),
      inventoryLocationId: id,
      referenceNumber: z.string().trim().min(3).max(100),
      receivedAt: date,
      note: z.string().trim().min(10).max(500),
      items: z
        .array(
          z
            .object({
              materialId: id,
              quantity: stockQuantitySchema.positive(),
              unitCost: invoiceMoneySchema,
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict()
    .superRefine(unique),
  z
    .object({
      action: z.literal("OPENING_REQUEST"),
      batchNumber: z.string().trim().min(3).max(100),
      cutoverDate: date,
      referenceNumber: z.string().trim().min(3).max(100),
      note: z.string().trim().min(10).max(1000),
      items: z
        .array(
          z
            .object({
              materialInventoryId: id,
              quantity: stockQuantitySchema.positive(),
              unitCost: invoiceMoneySchema.positive(),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict()
    .superRefine((v, ctx) => {
      if (new Set(v.items.map((item) => item.materialInventoryId)).size !== v.items.length)
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: "Inventory tidak boleh berulang.",
        });
    }),
  ...(["OPENING_APPROVE", "OPENING_REJECT", "OPENING_REVERSE"] as const).map((action) =>
    z
      .object({
        action: z.literal(action),
        batchId: id,
        reason: z.string().trim().min(10).max(1000),
      })
      .strict(),
  ),
]);
export type WarehouseIntakeInput = z.infer<typeof warehouseIntakeInputSchema>;
export const vendorBillCorrectionInputSchema = z
  .object({
    action: z.literal("VENDOR_BILL_CORRECT"),
    vendorBillId: id,
    patch: z
      .object({
        billNumber: z.string().trim().min(1).max(100).optional(),
        amount: invoiceMoneySchema.positive().optional(),
        dueDate: date.optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "Pilih perubahan tagihan."),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export type VendorBillCorrectionInput = z.infer<typeof vendorBillCorrectionInputSchema>;
export const stockCorrectionInputSchema = z
  .object({
    action: z.literal("STOCK_CORRECT"),
    inventoryLocationId: id,
    projectId: id.nullable().default(null),
    reason: z.string().trim().min(10, "Alasan koreksi minimal 10 karakter.").max(500),
    items: z
      .array(
        z
          .object({
            materialId: id,
            direction: z.enum(["INCREASE", "DECREASE"]),
            quantity: stockQuantitySchema.positive(),
            unitCost: invoiceMoneySchema.optional(),
            note: z.string().trim().min(10).max(500).optional(),
            projectRapItemId: id.nullable().optional(),
            projectCostId: id.nullable().optional(),
            vendorBillId: id.nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .refine(
        (items) => new Set(items.map((item) => item.materialId)).size === items.length,
        "Setiap material hanya boleh dikoreksi sekali per usulan.",
      ),
  })
  .strict();
export type StockCorrectionInput = z.infer<typeof stockCorrectionInputSchema>;
export const procurementWarehouseInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("VENDOR_BILL_SAVE"),
      draftId: id.optional(),
      expectedRevision: z.number().int().positive().optional(),
      payload: billProposalPayloadSchema,
    })
    .strict(),
  z.object({ action: z.literal("VENDOR_BILL_SUBMIT"), draftId: id }).strict(),
  transfer,
  count,
  ...receiptReversalInputSchema.options,
  z.object({ action: z.literal("STOCK_COUNT_SUBMIT"), stockCountId: id }).strict(),
  z.object({ action: z.literal("STOCK_COUNT_APPROVE"), stockCountId: id }).strict(),
  z
    .object({
      action: z.literal("STOCK_COUNT_REJECT"),
      stockCountId: id,
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
  ...warehouseIntakeInputSchema.options,
  vendorBillCorrectionInputSchema,
  stockCorrectionInputSchema,
]);
export type ProcurementWarehouseInput = z.infer<typeof procurementWarehouseInputSchema>;
export type ProcurementWarehouseAction = ProcurementWarehouseInput["action"];
export function procurementWarehousePermission(action: ProcurementWarehouseAction): PermissionKey {
  switch (action) {
    case "STOCK_CORRECT":
      return "adjust:stock";
    case "VENDOR_BILL_CORRECT":
      return "update:vendor_bill";
    case "PROJECT_RECEIPT":
    case "WAREHOUSE_STOCK_IN":
      return "create:stock_movement";
    case "OPENING_REQUEST":
      return "create:opening_inventory";
    case "OPENING_APPROVE":
    case "OPENING_REJECT":
      return "approve:opening_inventory";
    case "OPENING_REVERSE":
      return "reverse:opening_inventory";
    case "VENDOR_BILL_SAVE":
    case "VENDOR_BILL_SUBMIT":
      return "create:vendor_bill";
    case "RECEIPT_REVERSAL_REQUEST":
      return "request:goods_receipt_reversal";
    case "RECEIPT_REVERSAL_APPROVE":
    case "RECEIPT_REVERSAL_REJECT":
      return "approve:goods_receipt_reversal";
    case "WAREHOUSE_TRANSFER":
      return "transfer:stock";
    case "STOCK_COUNT_SAVE":
    case "STOCK_COUNT_SUBMIT":
      return "create:stock_count";
    case "STOCK_COUNT_APPROVE":
    case "STOCK_COUNT_REJECT":
      return "approve:stock_count";
  }
}
const fact = z
  .object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
    money: z.boolean().default(false),
  })
  .strict();
const comparison = z
  .object({
    label: z.string(),
    before: z.number(),
    after: z.number(),
    money: z.boolean().default(false),
  })
  .strict();
export const procurementWarehouseProposalSchema = z
  .object({
    kind: z.literal(PROCUREMENT_WAREHOUSE_KIND),
    action: z.enum([
      "STOCK_CORRECT",
      "VENDOR_BILL_CORRECT",
      "VENDOR_BILL_SAVE",
      "VENDOR_BILL_SUBMIT",
      "WAREHOUSE_TRANSFER",
      "RECEIPT_REVERSAL_REQUEST",
      "RECEIPT_REVERSAL_APPROVE",
      "RECEIPT_REVERSAL_REJECT",
      "STOCK_COUNT_SAVE",
      "STOCK_COUNT_SUBMIT",
      "STOCK_COUNT_APPROVE",
      "STOCK_COUNT_REJECT",
      "PROJECT_RECEIPT",
      "WAREHOUSE_STOCK_IN",
      "OPENING_REQUEST",
      "OPENING_APPROVE",
      "OPENING_REJECT",
      "OPENING_REVERSE",
    ]),
    input: procurementWarehouseInputSchema,
    title: z.string(),
    entityName: z.string(),
    meta: z.string(),
    projectId: id.nullable(),
    contextHash: z.string().regex(/^[a-f0-9]{64}$/),
    effect: z.string(),
    rows: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            meta: z.string(),
            amount: z.number().nullable(),
            comparisons: z.array(comparison),
            details: z.array(fact),
          })
          .strict(),
      )
      .max(101),
    summary: z.array(fact),
    budget: z.array(fact).nullable(),
  })
  .strict()
  .refine((v) => v.action === v.input.action, "Tindakan tidak cocok.");
export type ProcurementWarehouseProposal = z.infer<typeof procurementWarehouseProposalSchema>;
export const procurementWarehouseIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type ProcurementWarehouseView = {
  readonly proposal: ProcurementWarehouseProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type ProcurementWarehouseReceipt = {
  readonly resultId: string;
  readonly alreadyConfirmed: boolean;
};

export const vendorBillOperationInputSchema = z.union([
  procurementWarehouseInputSchema.options[0],
  procurementWarehouseInputSchema.options[1],
]);
export const warehouseOperationInputSchema = z.union([
  receiptReversalInputSchema,
  procurementWarehouseInputSchema.options[2],
  procurementWarehouseInputSchema.options[3],
  procurementWarehouseInputSchema.options[7],
  procurementWarehouseInputSchema.options[8],
  procurementWarehouseInputSchema.options[9],
]);
