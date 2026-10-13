import {
  createMaterialMastersTx,
  lockMaterialCatalog,
} from "@backend/server/usecases/material/master-writer";
import { eq } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { z } from "zod";

import { db } from "@backend/db";
import { inventoryLocation, vendor } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import { assertSettingsPermission, getSessionUser } from "./system-utils";

const materialImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().trim().max(255),
  categoryName: z.string().trim().max(100),
  unit: z.string().trim().max(50),
  locationName: z.string().trim().max(100),
  minimumStock: z.number(),
  lastPurchasePrice: z.number(),
  vendorName: z.string().trim().max(255).optional().default(""),
  specification: z.string().trim().max(1000).optional().default(""),
  brand: z.string().trim().max(100).optional().default(""),
  code: z.string().trim().max(100).optional().default(""),
  color: z.string().trim().max(100).optional().default(""),
});
const materialImportSchema = z.object({ rows: z.array(materialImportRowSchema).min(1) });
export type MaterialImportInput = z.infer<typeof materialImportSchema>;
export type MaterialImportPreview = {
  readonly items: readonly (z.infer<typeof materialImportRowSchema> & {
    readonly categoryId: string;
    readonly locationId: string;
    readonly vendorId: string | null;
  })[];
  readonly errors: readonly { readonly rowNumber: number; readonly message: string }[];
};

async function resolveMaterialImport(
  input: unknown,
): Promise<ActionResponse<MaterialImportPreview>> {
  const validation = materialImportSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data import material tidak valid.",
      },
    };
  const [categories, locations, vendors, existingMaterials] = await Promise.all([
    db.query.materialCategory.findMany(),
    db.query.inventoryLocation.findMany({ where: eq(inventoryLocation.isActive, true) }),
    db.query.vendor.findMany({ where: eq(vendor.isActive, true) }),
    db.query.materialMaster.findMany({ columns: { name: true, code: true } }),
  ]);
  const items: MaterialImportPreview["items"][number][] = [];
  const errors: MaterialImportPreview["errors"][number][] = [];
  const seenNames = new Set(
    existingMaterials.map((row) => row.name.trim().toLocaleLowerCase("id-ID")),
  );
  const seenCodes = new Set(
    existingMaterials
      .map((row) => row.code?.trim().toLocaleLowerCase("id-ID"))
      .filter((value): value is string => Boolean(value)),
  );
  const findUnique = <T extends { readonly name: string }>(
    rows: readonly T[],
    name: string,
  ): T | null => {
    const matches = rows.filter(
      (row) =>
        row.name.trim().toLocaleLowerCase("id-ID") === name.trim().toLocaleLowerCase("id-ID"),
    );
    return matches.length === 1 ? matches[0] : null;
  };

  for (const row of validation.data.rows) {
    const category = findUnique(categories, row.categoryName);
    const location = findUnique(locations, row.locationName);
    const selectedVendor = row.vendorName ? findUnique(vendors, row.vendorName) : null;
    const normalizedName = row.name.toLocaleLowerCase("id-ID");
    const normalizedCode = row.code.toLocaleLowerCase("id-ID");
    const rowErrors: string[] = [];
    if (row.name.length < 2) rowErrors.push("Nama material minimal 2 karakter.");
    if (!row.categoryName) rowErrors.push("Kategori material wajib diisi.");
    if (!row.unit) rowErrors.push("Satuan wajib diisi.");
    if (!row.locationName) rowErrors.push("Lokasi wajib diisi.");
    if (!Number.isFinite(row.minimumStock) || row.minimumStock < 0)
      rowErrors.push("Minimum stok tidak boleh negatif.");
    if (!Number.isFinite(row.lastPurchasePrice) || row.lastPurchasePrice < 0)
      rowErrors.push("Harga acuan tidak boleh negatif.");
    if (!category) rowErrors.push("Kategori material tidak ditemukan atau ambigu.");
    if (!location) rowErrors.push("Lokasi inventory tidak ditemukan atau ambigu.");
    if (row.vendorName && !selectedVendor) rowErrors.push("Vendor tidak ditemukan atau ambigu.");
    if (seenNames.has(normalizedName))
      rowErrors.push("Nama material sudah digunakan atau duplikat di file.");
    if (normalizedCode && seenCodes.has(normalizedCode))
      rowErrors.push("Code material sudah digunakan atau duplikat di file.");
    if (rowErrors.length > 0 || !category || !location) {
      errors.push({ rowNumber: row.rowNumber, message: rowErrors.join(" ") });
      continue;
    }
    seenNames.add(normalizedName);
    if (normalizedCode) seenCodes.add(normalizedCode);
    items.push({
      ...row,
      categoryId: category.id,
      locationId: location.id,
      vendorId: selectedVendor?.id ?? null,
    });
  }
  return { success: true, data: { items, errors } };
}

export async function previewMaterialImport(
  input: unknown,
): Promise<ActionResponse<MaterialImportPreview>> {
  const current = await getSessionUser();
  if (!current)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const access = await assertSettingsPermission(current, "manage:material_settings");
  if (access) return access;
  return resolveMaterialImport(input);
}

export async function commitMaterialImport(
  input: unknown,
): Promise<ActionResponse<{ readonly created: number }>> {
  const current = await getSessionUser();
  if (!current)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const access = await assertSettingsPermission(current, "manage:material_settings");
  if (access) return access;
  const resolved = await resolveMaterialImport(input);
  if (!resolved.success) return resolved;
  if (resolved.data.errors.length > 0 || resolved.data.items.length === 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Perbaiki seluruh error pada preview sebelum import.",
      },
    };
  }
  try {
    await db.transaction(async (tx) => {
      await lockMaterialCatalog(tx);
      await createMaterialMastersTx(
        tx,
        current.id,
        resolved.data.items.map((row) => ({
          input: {
            ...row,
            categoryId: row.categoryId,
            defaultVendorId: row.vendorId,
            inventoryDefaults: [
              {
                inventoryLocationId: row.locationId,
                minimumStock: row.minimumStock,
                lastPurchasePrice: row.lastPurchasePrice,
              },
            ],
          },
          source: { row: row.rowNumber },
        })),
      );
    });
    revalidatePath("/settings");
    revalidatePath("/materials");
    revalidatePath("/onboarding");
    return { success: true, data: { created: resolved.data.items.length } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Import material gagal dan seluruh perubahan dibatalkan.",
      },
    };
  }
}
