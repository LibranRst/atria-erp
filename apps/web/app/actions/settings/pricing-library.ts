"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  expenseCategory,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
  materialMaster,
  vendor,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { calculateSuggestedClientPrice, roundMoney } from "@/lib/project/pricing";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  upsertPricingTemplateSchema,
  type UpsertPricingTemplateInput,
} from "@/lib/validations/workflow-governance";

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

async function validateReferences(input: UpsertPricingTemplateInput): Promise<void> {
  const category = await db.query.expenseCategory.findFirst({
    where: eq(expenseCategory.id, input.expenseCategoryId),
  });
  if (!category) throw new Error("EXPENSE_CATEGORY_NOT_FOUND");
  const requiredCategory: Readonly<Record<string, string>> = {
    MATERIAL_ITEM: "MATERIAL",
    WORK_PACKAGE: "TUKANG",
    SUBCON_PACKAGE: "SUBCON",
  };
  const expectedCode = requiredCategory[input.itemType];
  if (expectedCode && category.code !== expectedCode) {
    throw new Error(`Tipe ${input.itemType} wajib memakai kategori ${expectedCode}.`);
  }
  if (input.materialId) {
    const material = await db.query.materialMaster.findFirst({
      where: eq(materialMaster.id, input.materialId),
    });
    if (!material) throw new Error("MATERIAL_NOT_FOUND");
  }
  const vendorIds = new Set(
    [
      input.defaultVendorId ?? undefined,
      ...input.components.map((component) => component.vendorId ?? undefined),
    ].filter((id): id is string => Boolean(id)),
  );
  for (const vendorId of vendorIds) {
    const existingVendor = await db.query.vendor.findFirst({ where: eq(vendor.id, vendorId) });
    if (!existingVendor) throw new Error("VENDOR_NOT_FOUND");
  }
}

export async function upsertPricingTemplate(
  input: UpsertPricingTemplateInput,
): Promise<ActionResponse<PricingTemplateRow>> {
  const validation = upsertPricingTemplateSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Template harga tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    await assertPermission(user, "manage:item_library");
    await validateReferences(validation.data);
    const totalInternalCost = roundMoney(
      validation.data.components.reduce(
        (sum, component) => sum + component.quantity * component.unitCost,
        0,
      ),
    );
    const suggestedPrice =
      validation.data.pricingMode === "MARGIN_BASED"
        ? calculateSuggestedClientPrice(totalInternalCost, validation.data.targetGrossPercentage)
        : (validation.data.fixedClientPrice ?? 0);

    const templateId = await db.transaction(async (tx) => {
      const existing = validation.data.itemPriceLibraryId
        ? await tx.query.itemPriceLibrary.findFirst({
            where: eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId),
          })
        : null;
      if (validation.data.itemPriceLibraryId && !existing)
        throw new Error("ITEM_PRICE_LIBRARY_NOT_FOUND");

      const values = {
        expenseCategoryId: validation.data.expenseCategoryId,
        materialId: validation.data.materialId ?? null,
        defaultVendorId: validation.data.defaultVendorId ?? null,
        code: validation.data.code || null,
        itemType: validation.data.itemType,
        itemCategory: validation.data.itemCategory,
        name: validation.data.name,
        description: validation.data.description ?? null,
        unit: validation.data.unit,
        defaultClientPrice: roundMoney(suggestedPrice).toFixed(2),
        defaultInternalCost: totalInternalCost.toFixed(2),
        pricingMode: validation.data.pricingMode,
        targetGrossPercentage: validation.data.targetGrossPercentage.toFixed(4),
        priceSourceType: validation.data.priceSourceType,
        sourceNote: validation.data.sourceNote,
        effectiveFrom: validation.data.effectiveFrom,
        isActive: validation.data.isActive ?? true,
        updatedById: user.id,
        updatedAt: new Date(),
      };

      const [saved] = existing
        ? await tx
            .update(itemPriceLibrary)
            .set(values)
            .where(eq(itemPriceLibrary.id, existing.id))
            .returning()
        : await tx.insert(itemPriceLibrary).values(values).returning();

      await tx
        .delete(itemPriceLibraryCostComponent)
        .where(eq(itemPriceLibraryCostComponent.itemPriceLibraryId, saved.id));
      await tx.insert(itemPriceLibraryCostComponent).values(
        validation.data.components.map((component, index) => ({
          itemPriceLibraryId: saved.id,
          vendorId: component.vendorId ?? null,
          componentType: component.componentType,
          label: component.label,
          quantity: component.quantity.toFixed(2),
          unit: component.unit,
          unitCost: component.unitCost.toFixed(2),
          totalCost: roundMoney(component.quantity * component.unitCost).toFixed(2),
          note: component.note ?? null,
          displayOrder: component.displayOrder ?? index,
        })),
      );
      await tx.insert(auditLog).values({
        userId: user.id,
        action: existing ? "UPDATE_PRICING_TEMPLATE" : "CREATE_PRICING_TEMPLATE",
        targetTable: "item_price_library",
        targetId: saved.id,
        originalState: existing ? JSON.stringify(existing) : null,
        newState: JSON.stringify({ ...saved, components: validation.data.components }),
      });
      return saved.id;
    });

    revalidatePath("/settings");
    revalidatePath("/settings/library");
    const rows = await db.query.itemPriceLibrary.findFirst({
      where: eq(itemPriceLibrary.id, templateId),
      with: {
        expenseCategory: true,
        costComponents: { orderBy: [asc(itemPriceLibraryCostComponent.displayOrder)] },
      },
    });
    if (!rows) throw new Error("ITEM_PRICE_LIBRARY_NOT_FOUND");
    return { success: true, data: mapTemplate(rows) };
  } catch (error) {
    return toFailure(error, "Gagal menyimpan template harga.");
  }
}
