import { eq } from "drizzle-orm";
import { db } from "@backend/db";
import { itemPriceLibrary } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import {
  writeCatalogSettingsTx,
  CatalogSettingsError,
} from "@backend/server/usecases/settings/catalog-settings-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  createItemPriceLibraryItemSchema,
  updateItemPriceLibraryItemSchema,
  archiveItemPriceLibraryItemSchema,
  setItemPriceLibraryItemActiveSchema,
  type CreateItemPriceLibraryItemInput,
  type UpdateItemPriceLibraryItemInput,
  type ArchiveItemPriceLibraryItemInput,
  type SetItemPriceLibraryItemActiveInput,
} from "@atria/core/validations/settings";
import type { CatalogSettingsInput } from "@atria/core/ai/catalog-settings";
import type { ItemPriceLibraryRow } from "./system-types";
import { mapItemLibraryRow } from "./system-utils";
import type { ActionResponse } from "@atria/core/types/action-response";
async function write(input: CatalogSettingsInput): Promise<ActionResponse<ItemPriceLibraryRow>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction(async (tx) => {
      const id = await writeCatalogSettingsTx(tx, actor, input);
      const saved = await tx.query.itemPriceLibrary.findFirst({
        where: eq(itemPriceLibrary.id, id),
        with: { expenseCategory: true, material: true },
      });
      if (!saved) throw new Error("Item tidak tersedia.");
      return mapItemLibraryRow(saved);
    });
    revalidateWorkspacePath("/settings");
    return { success: true, data: row };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof CatalogSettingsError ? error.code : "CONFLICT",
        message:
          error instanceof CatalogSettingsError
            ? error.message
            : "Item library belum tersimpan. Periksa isian dan data terbaru.",
      },
    };
  }
}
export async function createItemPriceLibraryItem(
  input: CreateItemPriceLibraryItemInput,
): Promise<ActionResponse<ItemPriceLibraryRow>> {
  const v = createItemPriceLibraryItemSchema.safeParse(input);
  if (!v.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Item tidak valid." } };
  return write({ action: "LIBRARY_CREATE", payload: v.data });
}
export async function updateItemPriceLibraryItem(
  input: UpdateItemPriceLibraryItemInput,
): Promise<ActionResponse<ItemPriceLibraryRow>> {
  const v = updateItemPriceLibraryItemSchema.safeParse(input);
  if (!v.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Item tidak valid." } };
  const { itemPriceLibraryId, ...patch } = v.data;
  return write({ action: "LIBRARY_EDIT", itemPriceLibraryId, patch });
}
export async function archiveItemPriceLibraryItem(
  input: ArchiveItemPriceLibraryItemInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const v = archiveItemPriceLibraryItemSchema.safeParse(input);
  if (!v.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "ID item tidak valid." } };
  const r = await write({ action: "LIBRARY_ARCHIVE", ...v.data });
  return r.success ? { success: true, data: { id: r.data.id } } : r;
}
export async function setItemPriceLibraryItemActive(
  input: SetItemPriceLibraryItemActiveInput,
): Promise<ActionResponse<{ readonly id: string; readonly isActive: boolean }>> {
  const v = setItemPriceLibraryItemActiveSchema.safeParse(input);
  if (!v.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "ID item tidak valid." } };
  const r = await write({ action: "LIBRARY_STATUS", ...v.data });
  return r.success ? { success: true, data: { id: r.data.id, isActive: r.data.isActive } } : r;
}
