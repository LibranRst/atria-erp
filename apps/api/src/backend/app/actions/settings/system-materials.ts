import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { auditLog, materialCategory, materialInventory, materialMaster } from "@backend/db/schema";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  archiveMaterialSchema,
  createMaterialCategorySettingSchema,
  createMaterialWithInventoryDefaultsSchema,
  setMaterialActiveSchema,
  updateMaterialInventoryDefaultsSchema,
  updateMaterialSettingDefaultsSchema,
  updateMaterialSchema,
  type ArchiveMaterialInput,
  type CreateMaterialCategorySettingInput,
  type CreateMaterialWithInventoryDefaultsInput,
  type SetMaterialActiveInput,
  type UpdateMaterialInput,
  type UpdateMaterialInventoryDefaultsInput,
  type UpdateMaterialSettingDefaultsInput,
} from "@atria/core/validations/settings";
import type { MaterialInventorySettingRow, MaterialSettingRow } from "./system-types";
import {
  assertSettingsPermission,
  getSessionUser,
  revalidateSettings,
  toMoney,
  toNullableText,
  writeSettingsAudit,
} from "./system-utils";
import { getSettingsOverview } from "./system-read";

export async function updateMaterial(
  input: UpdateMaterialInput,
): Promise<ActionResponse<MaterialSettingRow>> {
  const validation = updateMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Material tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;

  const existing = await db.query.materialMaster.findFirst({
    where: eq(materialMaster.id, validation.data.materialId),
  });
  if (!existing)
    return { success: false, error: { code: "NOT_FOUND", message: "Material tidak ditemukan." } };

  const [updated] = await db
    .update(materialMaster)
    .set({
      categoryId: validation.data.categoryId,
      defaultVendorId: validation.data.defaultVendorId ?? null,
      name: validation.data.name.trim(),
      specification: toNullableText(validation.data.specification),
      brand: toNullableText(validation.data.brand),
      code: toNullableText(validation.data.code),
      color: toNullableText(validation.data.color),
      unit: validation.data.unit.trim(),
      isActive: validation.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(materialMaster.id, validation.data.materialId))
    .returning();

  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_MATERIAL_SETTING",
    targetTable: "material_master",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });

  revalidatePath("/settings");
  revalidatePath("/materials");
  const overview = await getSettingsOverview();
  if (!overview.success) return overview;
  const material = overview.data.materials.find((row) => row.id === updated.id);
  if (!material)
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Material terupdate tetapi gagal dibaca." },
    };
  return { success: true, data: material };
}

export async function updateMaterialInventoryDefaults(
  input: UpdateMaterialInventoryDefaultsInput,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  const validation = updateMaterialInventoryDefaultsSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Default inventory tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;

  const existing = await db.query.materialInventory.findFirst({
    where: eq(materialInventory.id, validation.data.materialInventoryId),
    with: { location: true },
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Inventory material tidak ditemukan." },
    };

  const [updated] = await db
    .update(materialInventory)
    .set({
      minimumStock: validation.data.minimumStock.toFixed(2),
      averageCost: toMoney(validation.data.averageCost),
      lastPurchasePrice: toMoney(validation.data.lastPurchasePrice),
      updatedAt: new Date(),
    })
    .where(eq(materialInventory.id, validation.data.materialInventoryId))
    .returning();

  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_MATERIAL_INVENTORY_DEFAULTS",
    targetTable: "material_inventory",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });

  revalidatePath("/settings");
  revalidatePath("/materials");
  return {
    success: true,
    data: {
      id: updated.id,
      locationId: updated.locationId,
      locationName: existing.location.name,
      currentStock: Number(updated.currentStock),
      reservedStock: Number(updated.reservedStock),
      minimumStock: Number(updated.minimumStock),
      averageCost: Number(updated.averageCost),
      lastPurchasePrice: Number(updated.lastPurchasePrice),
    },
  };
}

export async function archiveMaterial(
  input: ArchiveMaterialInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = archiveMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID material tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;

  const [updated] = await db
    .update(materialMaster)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(materialMaster.id, validation.data.materialId))
    .returning();

  if (!updated)
    return { success: false, error: { code: "NOT_FOUND", message: "Material tidak ditemukan." } };

  await writeSettingsAudit({
    userId: user.id,
    action: "ARCHIVE_MATERIAL_SETTING",
    targetTable: "material_master",
    targetId: updated.id,
    newState: updated,
  });

  revalidatePath("/settings");
  revalidatePath("/materials");
  return { success: true, data: { id: updated.id } };
}

export async function createMaterialWithInventoryDefaults(
  input: CreateMaterialWithInventoryDefaultsInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = createMaterialWithInventoryDefaultsSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Material tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(materialMaster)
      .values({
        categoryId: validation.data.categoryId,
        defaultVendorId: validation.data.defaultVendorId ?? null,
        name: validation.data.name.trim(),
        specification: toNullableText(validation.data.specification),
        brand: toNullableText(validation.data.brand),
        code: toNullableText(validation.data.code),
        color: toNullableText(validation.data.color),
        unit: validation.data.unit.trim(),
      })
      .returning();
    await tx.insert(materialInventory).values(
      validation.data.inventoryDefaults.map((inventory) => ({
        materialId: created.id,
        locationId: inventory.inventoryLocationId,
        currentStock: "0.00",
        reservedStock: "0.00",
        minimumStock: inventory.minimumStock.toFixed(2),
        averageCost: "0.00",
        lastPurchasePrice: toMoney(inventory.lastPurchasePrice),
      })),
    );
    await tx.insert(auditLog).values({
      userId: user.id,
      action: "CREATE_MATERIAL_WITH_INVENTORY_DEFAULTS",
      targetTable: "material_master",
      targetId: created.id,
      newState: JSON.stringify({
        material: created,
        inventoryDefaults: validation.data.inventoryDefaults,
      }),
    });
    await recordReadinessMilestonesTx({
      tx,
      actorUserId: user.id,
      changedItem: "material_foundation",
    });
    return created.id;
  });
  revalidateSettings();
  revalidatePath("/materials");
  return { success: true, data: { id: createdId } };
}

export async function updateMaterialSettingDefaults(
  input: UpdateMaterialSettingDefaultsInput,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  const validation = updateMaterialSettingDefaultsSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Default inventory tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;
  const existing = await db.query.materialInventory.findFirst({
    where: eq(materialInventory.id, validation.data.materialInventoryId),
    with: { location: true },
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Inventory material tidak ditemukan." },
    };
  const [updated] = await db
    .update(materialInventory)
    .set({
      minimumStock: validation.data.minimumStock.toFixed(2),
      lastPurchasePrice: toMoney(validation.data.lastPurchasePrice),
      updatedAt: new Date(),
    })
    .where(eq(materialInventory.id, existing.id))
    .returning();
  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_MATERIAL_SETTING_DEFAULTS",
    targetTable: "material_inventory",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });
  revalidateSettings();
  return {
    success: true,
    data: {
      id: updated.id,
      locationId: updated.locationId,
      locationName: existing.location.name,
      currentStock: Number(updated.currentStock),
      reservedStock: Number(updated.reservedStock),
      minimumStock: Number(updated.minimumStock),
      averageCost: Number(updated.averageCost),
      lastPurchasePrice: Number(updated.lastPurchasePrice),
    },
  };
}

export async function setMaterialActive(
  input: SetMaterialActiveInput,
): Promise<ActionResponse<{ readonly id: string; readonly isActive: boolean }>> {
  const validation = setMaterialActiveSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Status material tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;
  const existing = await db.query.materialMaster.findFirst({
    where: eq(materialMaster.id, validation.data.materialId),
  });
  if (!existing)
    return { success: false, error: { code: "NOT_FOUND", message: "Material tidak ditemukan." } };
  const [updated] = await db
    .update(materialMaster)
    .set({ isActive: validation.data.isActive, updatedAt: new Date() })
    .where(eq(materialMaster.id, existing.id))
    .returning();
  await writeSettingsAudit({
    userId: user.id,
    action: validation.data.isActive ? "REACTIVATE_MATERIAL_SETTING" : "ARCHIVE_MATERIAL_SETTING",
    targetTable: "material_master",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });
  revalidateSettings();
  revalidatePath("/materials");
  return { success: true, data: { id: updated.id, isActive: updated.isActive } };
}

export async function createMaterialCategorySetting(
  input: CreateMaterialCategorySettingInput,
): Promise<ActionResponse<{ readonly id: string; readonly name: string }>> {
  const validation = createMaterialCategorySettingSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Kategori material tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const accessError = await assertSettingsPermission(user, "manage:material_settings");
  if (accessError) return accessError;
  const [created] = await db
    .insert(materialCategory)
    .values({
      name: validation.data.name.trim(),
      description: toNullableText(validation.data.description),
    })
    .returning();
  await writeSettingsAudit({
    userId: user.id,
    action: "CREATE_MATERIAL_CATEGORY_SETTING",
    targetTable: "material_category",
    targetId: created.id,
    newState: created,
  });
  revalidateSettings();
  return { success: true, data: { id: created.id, name: created.name } };
}
