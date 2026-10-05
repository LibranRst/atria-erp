import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { expenseCategory, itemPriceLibrary, materialMaster } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  archiveItemPriceLibraryItemSchema,
  createItemPriceLibraryItemSchema,
  setItemPriceLibraryItemActiveSchema,
  updateItemPriceLibraryItemSchema,
  type ArchiveItemPriceLibraryItemInput,
  type CreateItemPriceLibraryItemInput,
  type SetItemPriceLibraryItemActiveInput,
  type UpdateItemPriceLibraryItemInput,
} from "@atria/core/validations/settings";
import type { ItemPriceLibraryRow } from "./system-types";
import {
  assertSettingsPermission,
  getSessionUser,
  revalidateSettings,
  toMoney,
  toNullableText,
  writeSettingsAudit,
} from "./system-utils";
import { getItemPriceLibrary } from "./system-read";

async function validateItemLibraryCombination(input: {
  readonly expenseCategoryId: string;
  readonly itemType: string;
  readonly materialId?: string | null;
}): Promise<string | null> {
  const category = await db.query.expenseCategory.findFirst({
    where: eq(expenseCategory.id, input.expenseCategoryId),
  });
  if (!category) return "Kategori expense tidak ditemukan.";
  const requiredCategory: Readonly<Record<string, string>> = {
    MATERIAL_ITEM: "MATERIAL",
    WORK_PACKAGE: "TUKANG",
    SUBCON_PACKAGE: "SUBCON",
  };
  const requiredCode = requiredCategory[input.itemType];
  if (requiredCode && category.code !== requiredCode)
    return `Tipe item ini wajib memakai kategori ${requiredCode}.`;
  if (input.itemType !== "MATERIAL_ITEM" && input.materialId)
    return "Material hanya dapat ditautkan ke Material Item.";
  if (input.materialId) {
    const material = await db.query.materialMaster.findFirst({
      where: eq(materialMaster.id, input.materialId),
    });
    if (!material) return "Material yang dipilih tidak ditemukan.";
  }
  return null;
}

export async function createItemPriceLibraryItem(
  input: CreateItemPriceLibraryItemInput,
): Promise<ActionResponse<ItemPriceLibraryRow>> {
  const validation = createItemPriceLibraryItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Item library tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:item_library");
  if (accessError) return accessError;

  const combinationError = await validateItemLibraryCombination(validation.data);
  if (combinationError)
    return { success: false, error: { code: "VALIDATION_ERROR", message: combinationError } };

  const [created] = await db
    .insert(itemPriceLibrary)
    .values({
      expenseCategoryId: validation.data.expenseCategoryId,
      materialId: validation.data.materialId ?? null,
      code: toNullableText(validation.data.code),
      itemType: validation.data.itemType,
      itemCategory: validation.data.itemCategory.trim(),
      name: validation.data.name.trim(),
      description: toNullableText(validation.data.description),
      unit: validation.data.unit.trim(),
      defaultClientPrice: toMoney(validation.data.defaultClientPrice),
      defaultInternalCost: toMoney(validation.data.defaultInternalCost),
      updatedById: user.id,
    })
    .returning();

  await writeSettingsAudit({
    userId: user.id,
    action: "CREATE_ITEM_PRICE_LIBRARY_ITEM",
    targetTable: "item_price_library",
    targetId: created.id,
    newState: created,
  });

  revalidatePath("/settings");
  const rows = await getItemPriceLibrary({ includeInactive: true });
  if (!rows.success) return rows;
  const createdRow = rows.data.find((row) => row.id === created.id);
  if (!createdRow)
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Item dibuat tetapi gagal dibaca." },
    };
  return { success: true, data: createdRow };
}

export async function updateItemPriceLibraryItem(
  input: UpdateItemPriceLibraryItemInput,
): Promise<ActionResponse<ItemPriceLibraryRow>> {
  const validation = updateItemPriceLibraryItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Item library tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:item_library");
  if (accessError) return accessError;

  const combinationError = await validateItemLibraryCombination(validation.data);
  if (combinationError)
    return { success: false, error: { code: "VALIDATION_ERROR", message: combinationError } };

  const existing = await db.query.itemPriceLibrary.findFirst({
    where: eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId),
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Item library tidak ditemukan." },
    };

  const [updated] = await db
    .update(itemPriceLibrary)
    .set({
      expenseCategoryId: validation.data.expenseCategoryId,
      materialId: validation.data.materialId ?? null,
      code: toNullableText(validation.data.code),
      itemType: validation.data.itemType,
      itemCategory: validation.data.itemCategory.trim(),
      name: validation.data.name.trim(),
      description: toNullableText(validation.data.description),
      unit: validation.data.unit.trim(),
      defaultClientPrice: toMoney(validation.data.defaultClientPrice),
      defaultInternalCost: toMoney(validation.data.defaultInternalCost),
      isActive: validation.data.isActive,
      updatedById: user.id,
      updatedAt: new Date(),
    })
    .where(eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId))
    .returning();

  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_ITEM_PRICE_LIBRARY_ITEM",
    targetTable: "item_price_library",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });

  revalidatePath("/settings");
  const rows = await getItemPriceLibrary({ includeInactive: true });
  if (!rows.success) return rows;
  const updatedRow = rows.data.find((row) => row.id === updated.id);
  if (!updatedRow)
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Item terupdate tetapi gagal dibaca." },
    };
  return { success: true, data: updatedRow };
}

export async function archiveItemPriceLibraryItem(
  input: ArchiveItemPriceLibraryItemInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = archiveItemPriceLibraryItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID item library tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:item_library");
  if (accessError) return accessError;

  const [updated] = await db
    .update(itemPriceLibrary)
    .set({ isActive: false, updatedById: user.id, updatedAt: new Date() })
    .where(eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId))
    .returning();

  if (!updated)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Item library tidak ditemukan." },
    };

  await writeSettingsAudit({
    userId: user.id,
    action: "ARCHIVE_ITEM_PRICE_LIBRARY_ITEM",
    targetTable: "item_price_library",
    targetId: updated.id,
    newState: updated,
  });

  revalidatePath("/settings");
  return { success: true, data: { id: updated.id } };
}

export async function setItemPriceLibraryItemActive(
  input: SetItemPriceLibraryItemActiveInput,
): Promise<ActionResponse<{ readonly id: string; readonly isActive: boolean }>> {
  const validation = setItemPriceLibraryItemActiveSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Status item tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const accessError = await assertSettingsPermission(user, "manage:item_library");
  if (accessError) return accessError;
  const existing = await db.query.itemPriceLibrary.findFirst({
    where: eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId),
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Item library tidak ditemukan." },
    };
  const [updated] = await db
    .update(itemPriceLibrary)
    .set({
      isActive: validation.data.isActive,
      updatedById: user.id,
      updatedAt: new Date(),
    })
    .where(eq(itemPriceLibrary.id, existing.id))
    .returning();
  await writeSettingsAudit({
    userId: user.id,
    action: validation.data.isActive
      ? "REACTIVATE_ITEM_PRICE_LIBRARY_ITEM"
      : "ARCHIVE_ITEM_PRICE_LIBRARY_ITEM",
    targetTable: "item_price_library",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });
  revalidateSettings();
  return { success: true, data: { id: updated.id, isActive: updated.isActive } };
}
