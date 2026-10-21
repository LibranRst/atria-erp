import { resolveActor } from "@backend/server/actor";
import {
  writeCatalogSettingsTx,
  CatalogSettingsError,
} from "@backend/server/usecases/settings/catalog-settings-writer";
import {
  updateMaterialMasterTx,
  setMaterialActiveTx,
  materialEditFailure,
} from "@backend/server/usecases/material/master-editor";
import { createMaterialCategoryTx } from "@backend/server/usecases/material/reference-writer";
import { createMaterialMasterTx } from "@backend/server/usecases/material/master-writer";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { materialInventory, materialMaster } from "@backend/db/schema";
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
import { assertSettingsPermission, getSessionUser, revalidateSettings } from "./system-utils";
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

  let updated: typeof materialMaster.$inferSelect;
  try {
    updated = await db.transaction((tx) => updateMaterialMasterTx(tx, user.id, validation.data));
  } catch (error: unknown) {
    return materialEditFailure(error);
  }

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

async function saveInventoryDefaults(
  input: UpdateMaterialSettingDefaultsInput,
  averageCost?: number,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction(async (tx) => {
      await writeCatalogSettingsTx(tx, actor, { action: "INVENTORY_DEFAULTS", ...input });
      if (averageCost !== undefined)
        await writeCatalogSettingsTx(tx, actor, {
          action: "INVENTORY_VALUATION",
          materialInventoryId: input.materialInventoryId,
          averageCost,
          reason: "Koreksi biaya rata-rata melalui Pengaturan inventory.",
        });
      const saved = await tx.query.materialInventory.findFirst({
        where: eq(materialInventory.id, input.materialInventoryId),
        with: { location: true },
      });
      if (!saved) throw new Error("Inventory tidak tersedia.");
      return {
        id: saved.id,
        locationId: saved.locationId,
        locationName: saved.location.name,
        currentStock: Number(saved.currentStock),
        reservedStock: Number(saved.reservedStock),
        minimumStock: Number(saved.minimumStock),
        averageCost: Number(saved.averageCost),
        lastPurchasePrice: Number(saved.lastPurchasePrice),
      };
    });
    revalidateSettings();
    return { success: true, data: row };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof CatalogSettingsError ? error.code : "CONFLICT",
        message:
          error instanceof CatalogSettingsError
            ? error.message
            : "Pengaturan inventory belum tersimpan.",
      },
    };
  }
}
export async function updateMaterialInventoryDefaults(
  input: UpdateMaterialInventoryDefaultsInput,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  const v = updateMaterialInventoryDefaultsSchema.safeParse(input);
  if (!v.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Default inventory tidak valid." },
    };
  const { averageCost, ...defaults } = v.data;
  return saveInventoryDefaults(defaults, averageCost);
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

  let updated: typeof materialMaster.$inferSelect;
  try {
    updated = await db.transaction((tx) =>
      setMaterialActiveTx(tx, user.id, { materialId: validation.data.materialId, isActive: false }),
    );
  } catch (error: unknown) {
    return materialEditFailure(error);
  }

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

  const createdId = await db.transaction(
    async (tx) => (await createMaterialMasterTx(tx, user.id, validation.data)).id,
  );
  revalidateSettings();
  revalidatePath("/materials");
  return { success: true, data: { id: createdId } };
}

export async function updateMaterialSettingDefaults(
  input: UpdateMaterialSettingDefaultsInput,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  const v = updateMaterialSettingDefaultsSchema.safeParse(input);
  if (!v.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Default inventory tidak valid." },
    };
  return saveInventoryDefaults(v.data);
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
  let updated: typeof materialMaster.$inferSelect;
  try {
    updated = await db.transaction((tx) => setMaterialActiveTx(tx, user.id, validation.data));
  } catch (error: unknown) {
    return materialEditFailure(error);
  }

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
  const created = await db.transaction(async (tx) =>
    createMaterialCategoryTx(tx, user.id, validation.data),
  );
  revalidateSettings();
  return { success: true, data: { id: created.id, name: created.name } };
}
