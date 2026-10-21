import { z } from "zod";
import { vendorAdministrationSchema } from "../validations/administration";
import { createItemPriceLibraryItemSchema } from "../validations/settings";
import {
  upsertPricingTemplateSchema,
  pricingCostComponentSchema,
} from "../validations/workflow-governance";
import {
  stockQuantitySchema,
  invoiceMoneySchema,
  procurementWarehouseProposalSchema,
} from "./procurement-warehouse";
import type { PermissionKey } from "../auth/permissions";
const id = z.string().guid();
export const catalogVendorSchema = vendorAdministrationSchema
  .omit({ vendorId: true })
  .extend({
    // Gemini gateways turn an empty-string literal into an invalid empty enum.
    // Keep the same optional/clearable contract and enforce email validity at runtime.
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(255)
      .refine(
        (value) => value === "" || z.email().safeParse(value).success,
        "Email vendor tidak valid.",
      )
      .nullable()
      .optional()
      .describe("Email vendor yang valid; opsional, null atau kosong untuk menghapus email."),
  })
  .strict();
export const catalogLibrarySchema = createItemPriceLibraryItemSchema
  .extend({
    name: z.string().trim().min(2).max(255),
    unit: z.string().trim().min(1).max(50),
    itemCategory: z.string().trim().min(2).max(120),
    defaultClientPrice: invoiceMoneySchema,
    defaultInternalCost: invoiceMoneySchema,
  })
  .strict();
const nonempty = <T extends object>(patch: T): boolean => Object.keys(patch).length > 0;
export const catalogTemplateSchema = z
  .object({
    ...upsertPricingTemplateSchema.shape,
    effectiveFrom: z.iso.datetime({ offset: true }),
    fixedClientPrice: invoiceMoneySchema.optional(),
    targetGrossPercentage: z
      .number()
      .finite()
      .min(0)
      .max(0.95)
      .refine((n) => Number(n.toFixed(4)) === n, "Maksimal empat desimal."),
    components: z
      .array(
        pricingCostComponentSchema
          .extend({ quantity: stockQuantitySchema.positive(), unitCost: invoiceMoneySchema })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.pricingMode === "FIXED_CLIENT_PRICE" && v.fixedClientPrice === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["fixedClientPrice"],
        message: "Harga jual wajib diisi.",
      });
    const ids = v.components.map((c) => c.id).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["components"],
        message: "ID komponen tidak boleh berulang.",
      });
  });
export const catalogSettingsInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("VENDOR_CREATE"), payload: catalogVendorSchema }).strict(),
  z
    .object({
      action: z.literal("VENDOR_EDIT"),
      vendorId: id,
      patch: catalogVendorSchema
        .partial()
        .extend({ isActive: z.boolean().optional() })
        .refine(nonempty, "Isi perubahan vendor."),
    })
    .strict(),
  z.object({ action: z.literal("VENDOR_STATUS"), vendorId: id, isActive: z.boolean() }).strict(),
  z.object({ action: z.literal("LIBRARY_CREATE"), payload: catalogLibrarySchema }).strict(),
  z
    .object({
      action: z.literal("LIBRARY_EDIT"),
      itemPriceLibraryId: id,
      patch: catalogLibrarySchema
        .partial()
        .extend({ isActive: z.boolean().optional() })
        .refine(nonempty, "Isi perubahan item."),
    })
    .strict(),
  z
    .object({ action: z.literal("LIBRARY_STATUS"), itemPriceLibraryId: id, isActive: z.boolean() })
    .strict(),
  z.object({ action: z.literal("LIBRARY_ARCHIVE"), itemPriceLibraryId: id }).strict(),
  z.object({ action: z.literal("PRICING_TEMPLATE_SAVE"), payload: catalogTemplateSchema }).strict(),
  z
    .object({
      action: z.literal("INVENTORY_DEFAULTS"),
      materialInventoryId: id,
      minimumStock: stockQuantitySchema,
      lastPurchasePrice: invoiceMoneySchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("INVENTORY_VALUATION"),
      materialInventoryId: id,
      averageCost: invoiceMoneySchema,
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
]);
export type CatalogSettingsInput = z.infer<typeof catalogSettingsInputSchema>;
export type CatalogSettingsAction = CatalogSettingsInput["action"];
export function catalogSettingsPermission(action: CatalogSettingsAction): PermissionKey {
  return action.startsWith("VENDOR_")
    ? "manage:vendors"
    : action.startsWith("INVENTORY_")
      ? "manage:material_settings"
      : "manage:item_library";
}
export const CATALOG_SETTINGS_KIND = "CATALOG_SETTINGS";
export const catalogSettingsProposalSchema = z
  .object({
    ...procurementWarehouseProposalSchema.shape,
    projectId: z.null().default(null),
    budget: z.null().default(null),
    kind: z.literal(CATALOG_SETTINGS_KIND),
    action: z.enum([
      "VENDOR_CREATE",
      "VENDOR_EDIT",
      "VENDOR_STATUS",
      "LIBRARY_CREATE",
      "LIBRARY_EDIT",
      "LIBRARY_STATUS",
      "LIBRARY_ARCHIVE",
      "PRICING_TEMPLATE_SAVE",
      "INVENTORY_DEFAULTS",
      "INVENTORY_VALUATION",
    ]),
    input: catalogSettingsInputSchema,
    rows: z.array(procurementWarehouseProposalSchema.shape.rows.element).max(201),
  })
  .strict()
  .refine((v) => v.action === v.input.action, "Tindakan tidak cocok.");
export type CatalogSettingsProposal = z.infer<typeof catalogSettingsProposalSchema>;
export const catalogSettingsIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type CatalogSettingsView = {
  proposal: CatalogSettingsProposal;
  status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  resultId: string | null;
};
export type CatalogSettingsReceipt = { resultId: string; alreadyConfirmed: boolean };
