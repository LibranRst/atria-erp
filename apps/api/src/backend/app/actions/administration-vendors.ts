import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import {
  writeCatalogSettingsTx,
  CatalogSettingsError,
} from "@backend/server/usecases/settings/catalog-settings-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  vendorAdministrationSchema,
  setVendorActiveSchema,
  type VendorAdministrationInput,
} from "@atria/core/validations/administration";
import type { CatalogSettingsInput } from "@atria/core/ai/catalog-settings";
import type { ActionResponse } from "@atria/core/types/action-response";
async function write(
  input: CatalogSettingsInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const id = await db.transaction((tx) => writeCatalogSettingsTx(tx, actor, input));
    revalidateWorkspacePath("/settings");
    return { success: true, data: { id } };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof CatalogSettingsError ? error.code : "CONFLICT",
        message:
          error instanceof CatalogSettingsError
            ? error.message
            : "Vendor belum tersimpan. Periksa isian dan data terbaru.",
      },
    };
  }
}
export async function saveVendor(
  input: VendorAdministrationInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const v = vendorAdministrationSchema.safeParse(input);
  if (!v.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: v.error.issues[0]?.message ?? "Vendor tidak valid.",
      },
    };
  const { vendorId, ...payload } = v.data;
  return write(
    vendorId
      ? { action: "VENDOR_EDIT", vendorId, patch: payload }
      : { action: "VENDOR_CREATE", payload },
  );
}
export async function setVendorActive(
  input: unknown,
): Promise<ActionResponse<{ readonly id: string }>> {
  const v = setVendorActiveSchema.safeParse(input);
  if (!v.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Vendor tidak valid." } };
  return write({ action: "VENDOR_STATUS", ...v.data });
}
