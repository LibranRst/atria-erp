import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { asc, eq } from "drizzle-orm";

import { db } from "@backend/db";
import {
  expenseCategory,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission } from "@backend/lib/auth/permissions";
import { resolveActor } from "@backend/server/actor";
import {
  writeCatalogSettingsTx,
  CatalogSettingsError,
} from "@backend/server/usecases/settings/catalog-settings-writer";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  upsertPricingTemplateSchema,
  type UpsertPricingTemplateInput,
} from "@atria/core/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };

export type PricingTemplateRow = {
  readonly id: string;
  readonly expenseCategoryId: string;
  readonly expenseCategoryCode: string;
  readonly materialId: string | null;
  readonly defaultVendorId: string | null;
  readonly code: string | null;
  readonly itemType: string;
  readonly itemCategory: string;
  readonly name: string;
  readonly description: string | null;
  readonly unit: string;
  readonly defaultClientPrice: number;
  readonly defaultInternalCost: number;
  readonly pricingMode: string;
  readonly targetGrossPercentage: number;
  readonly priceSourceType: string;
  readonly sourceNote: string | null;
  readonly effectiveFrom: Date;
  readonly isActive: boolean;
  readonly components: readonly {
    readonly id: string;
    readonly vendorId: string | null;
    readonly componentType: string;
    readonly label: string;
    readonly quantity: number;
    readonly unit: string;
    readonly unitCost: number;
    readonly totalCost: number;
    readonly note: string | null;
    readonly displayOrder: number;
  }[];
};

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

function toFailure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("FORBIDDEN"))
    return { success: false, error: { code: "FORBIDDEN", message } };
  if (message.includes("NOT_FOUND"))
    return { success: false, error: { code: "NOT_FOUND", message: fallback } };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

function mapTemplate(
  row: typeof itemPriceLibrary.$inferSelect & {
    readonly expenseCategory: typeof expenseCategory.$inferSelect;
    readonly costComponents: readonly (typeof itemPriceLibraryCostComponent.$inferSelect)[];
  },
): PricingTemplateRow {
  return {
    id: row.id,
    expenseCategoryId: row.expenseCategoryId,
    expenseCategoryCode: row.expenseCategory.code,
    materialId: row.materialId,
    defaultVendorId: row.defaultVendorId,
    code: row.code,
    itemType: row.itemType,
    itemCategory: row.itemCategory,
    name: row.name,
    description: row.description,
    unit: row.unit,
    defaultClientPrice: Number(row.defaultClientPrice),
    defaultInternalCost: Number(row.defaultInternalCost),
    pricingMode: row.pricingMode,
    targetGrossPercentage: Number(row.targetGrossPercentage),
    priceSourceType: row.priceSourceType,
    sourceNote: row.sourceNote,
    effectiveFrom: row.effectiveFrom,
    isActive: row.isActive,
    components: row.costComponents.map((component) => ({
      id: component.id,
      vendorId: component.vendorId,
      componentType: component.componentType,
      label: component.label,
      quantity: Number(component.quantity),
      unit: component.unit,
      unitCost: Number(component.unitCost),
      totalCost: Number(component.totalCost),
      note: component.note,
      displayOrder: component.displayOrder,
    })),
  };
}

export async function getPricingTemplates(
  includeInactive = false,
): Promise<ActionResponse<readonly PricingTemplateRow[]>> {
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(user, "view:settings");
    const rows = await db.query.itemPriceLibrary.findMany({
      where: includeInactive ? undefined : eq(itemPriceLibrary.isActive, true),
      with: {
        expenseCategory: true,
        costComponents: { orderBy: [asc(itemPriceLibraryCostComponent.displayOrder)] },
      },
      orderBy: [asc(itemPriceLibrary.itemType), asc(itemPriceLibrary.name)],
    });
    return { success: true, data: rows.map(mapTemplate) };
  } catch (error) {
    return toFailure(error, "Gagal mengambil template harga.");
  }
}

export async function upsertPricingTemplate(
  input: UpsertPricingTemplateInput,
): Promise<ActionResponse<PricingTemplateRow>> {
  const v = upsertPricingTemplateSchema.safeParse(input);
  if (!v.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: v.error.issues[0]?.message ?? "Template tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction(async (tx) => {
      const id = await writeCatalogSettingsTx(tx, actor, {
        action: "PRICING_TEMPLATE_SAVE",
        payload: { ...v.data, effectiveFrom: v.data.effectiveFrom.toISOString() },
      });
      const saved = await tx.query.itemPriceLibrary.findFirst({
        where: eq(itemPriceLibrary.id, id),
        with: {
          expenseCategory: true,
          costComponents: { orderBy: [asc(itemPriceLibraryCostComponent.displayOrder)] },
        },
      });
      if (!saved) throw new Error("ITEM_PRICE_LIBRARY_NOT_FOUND");
      return mapTemplate(saved);
    });
    revalidatePath("/settings");
    revalidatePath("/settings/library");
    return { success: true, data: row };
  } catch (error: unknown) {
    if (error instanceof CatalogSettingsError)
      return { success: false, error: { code: error.code, message: error.message } };
    return toFailure(error, "Template belum tersimpan.");
  }
}
