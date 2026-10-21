import { db } from "@backend/db";
import {
  auditLog,
  inventoryLocation,
  materialCategory,
  materialInventory,
  materialMaster,
  tenant,
  vendor,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import { normalizeMaterialIdentity, type MaterialFields } from "@atria/core/ai/material-import";
import type { CreateMaterialWithInventoryDefaultsInput } from "@atria/core/validations/settings";
import { eq } from "drizzle-orm";

export async function lockMaterialCatalog(tx: FinanceTransaction): Promise<void> {
  const [owner] = await tx
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.id, INSTANCE_TENANT_ID))
    .for("update");
  if (!owner) throw new Error("Katalog organisasi tidak ditemukan.");
}
export async function assertMaterialIdentityAvailable(
  tx: FinanceTransaction,
  name: string,
  code?: string | null,
  existingId?: string,
): Promise<void> {
  const rows = await tx.query.materialMaster.findMany({
    where: eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
    columns: { id: true, name: true, code: true },
  });
  const existing = rows.find((row) => row.id === existingId);
  const changedName =
    !existing || normalizeMaterialIdentity(existing.name) !== normalizeMaterialIdentity(name);
  const changedCode =
    !existing ||
    normalizeMaterialIdentity(existing.code ?? "") !== normalizeMaterialIdentity(code ?? "");
  if (
    rows.some(
      (row) =>
        row.id !== existingId &&
        ((changedName && normalizeMaterialIdentity(row.name) === normalizeMaterialIdentity(name)) ||
          (changedCode &&
            code?.trim() &&
            normalizeMaterialIdentity(row.code ?? "") === normalizeMaterialIdentity(code))),
    )
  ) {
    throw new Error("Nama atau kode material sudah digunakan. Periksa kandidat duplikat.");
  }
}
export type MaterialReferences = {
  categories: (typeof materialCategory.$inferSelect)[];
  locations: (typeof inventoryLocation.$inferSelect)[];
  vendors: (typeof vendor.$inferSelect)[];
  materials: Pick<typeof materialMaster.$inferSelect, "id" | "name" | "code">[];
};
export type MaterialIdentityIndex = {
  readonly names: ReadonlySet<string>;
  readonly codes: ReadonlySet<string>;
  readonly folded: readonly { name: string; key: string }[];
};
const identityIndexes = new WeakMap<MaterialReferences, MaterialIdentityIndex>();
export function materialIdentityIndex(refs: MaterialReferences): MaterialIdentityIndex {
  const cached = identityIndexes.get(refs);
  if (cached) return cached;
  const index: MaterialIdentityIndex = {
    names: new Set(refs.materials.map((item) => normalizeMaterialIdentity(item.name))),
    codes: new Set(
      refs.materials.map((item) => normalizeMaterialIdentity(item.code ?? "")).filter(Boolean),
    ),
    folded: refs.materials.map((item) => ({
      name: item.name,
      key: normalizeMaterialIdentity(item.name).replace(/[^a-z0-9]/g, ""),
    })),
  };
  identityIndexes.set(refs, index);
  return index;
}
export async function loadMaterialReferences(
  connection: Pick<typeof db, "query"> = db,
): Promise<MaterialReferences> {
  const [categories, locations, vendors, materials] = await Promise.all([
    connection.query.materialCategory.findMany({
      where: eq(materialCategory.tenantId, INSTANCE_TENANT_ID),
    }),
    connection.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
    }),
    connection.query.vendor.findMany({ where: eq(vendor.tenantId, INSTANCE_TENANT_ID) }),
    connection.query.materialMaster.findMany({
      where: eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
      columns: { id: true, name: true, code: true },
    }),
  ]);
  return { categories, locations, vendors, materials };
}
function uniqueName<T extends { name: string }>(rows: readonly T[], name: string): T | undefined {
  const matches = rows.filter(
    (row) => normalizeMaterialIdentity(row.name) === normalizeMaterialIdentity(name),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function resolveMaterialFields(
  fields: MaterialFields,
  refs: MaterialReferences,
): { issues: string[]; input: CreateMaterialWithInventoryDefaultsInput | null } {
  const category = uniqueName(refs.categories, fields.categoryName);
  const location = uniqueName(
    refs.locations.filter((row) => row.isActive),
    fields.locationName,
  );
  const selectedVendor =
    fields.vendorName && !fields.withoutVendor
      ? uniqueName(
          refs.vendors.filter((row) => row.isActive),
          fields.vendorName,
        )
      : undefined;
  const issues: string[] = [];
  if (fields.name.trim().length < 2) issues.push("Nama material minimal 2 karakter.");
  if (!fields.unit.trim()) issues.push("Satuan wajib diisi.");
  if (!category) issues.push("Kategori belum ditemukan atau ambigu.");
  if (!location) issues.push("Lokasi aktif belum ditemukan atau ambigu.");
  if (fields.vendorName && !fields.withoutVendor && !selectedVendor)
    issues.push("Vendor belum ditemukan. Pilih tanpa vendor atau buat vendor sesuai izin.");
  const identity = materialIdentityIndex(refs);
  if (
    identity.names.has(normalizeMaterialIdentity(fields.name)) ||
    (fields.code && identity.codes.has(normalizeMaterialIdentity(fields.code)))
  )
    issues.push("Duplikat: nama atau kode sudah digunakan.");
  if (issues.length || !category || !location) return { issues, input: null };
  return {
    issues,
    input: {
      ...fields,
      categoryId: category.id,
      defaultVendorId: selectedVendor?.id ?? null,
      inventoryDefaults: [
        {
          inventoryLocationId: location.id,
          minimumStock: fields.minimumStock,
          lastPurchasePrice: fields.lastPurchasePrice,
        },
      ],
    },
  };
}
export type MaterialMasterCreate = {
  readonly input: CreateMaterialWithInventoryDefaultsInput;
  readonly source?: unknown;
};
export async function createMaterialMastersTx(
  tx: FinanceTransaction,
  userId: string,
  items: readonly MaterialMasterCreate[],
): Promise<(typeof materialMaster.$inferSelect)[]> {
  if (!items.length) throw new Error("Pilih minimal satu material.");
  await lockMaterialCatalog(tx);
  const refs = await loadMaterialReferences(tx);
  const names = new Set(refs.materials.map((row) => normalizeMaterialIdentity(row.name)));
  const codes = new Set(
    refs.materials.map((row) => normalizeMaterialIdentity(row.code ?? "")).filter(Boolean),
  );
  for (const { input } of items) {
    const name = normalizeMaterialIdentity(input.name);
    const code = normalizeMaterialIdentity(input.code ?? "");
    if (names.has(name) || (code && codes.has(code)))
      throw new Error("Nama atau kode material sudah digunakan. Periksa kandidat duplikat.");
    names.add(name);
    if (code) codes.add(code);
    if (
      !refs.categories.some((row) => row.id === input.categoryId) ||
      (input.defaultVendorId &&
        !refs.vendors.some((row) => row.id === input.defaultVendorId && row.isActive)) ||
      input.inventoryDefaults.some(
        (item) =>
          !refs.locations.some((row) => row.id === item.inventoryLocationId && row.isActive),
      )
    )
      throw new Error("Kategori, vendor, atau lokasi tidak tersedia. Periksa ulang draft.");
  }
  const created = await tx
    .insert(materialMaster)
    .values(
      items.map(({ input }) => ({
        categoryId: input.categoryId,
        name: input.name.trim(),
        unit: input.unit.trim(),
        defaultVendorId: input.defaultVendorId ?? null,
        specification: input.specification?.trim() || null,
        brand: input.brand?.trim() || null,
        code: input.code?.trim() || null,
        color: input.color?.trim() || null,
      })),
    )
    .returning();
  const byName = new Map(created.map((row) => [normalizeMaterialIdentity(row.name), row]));
  const paired = items.map((item) => {
    const row = byName.get(normalizeMaterialIdentity(item.input.name));
    if (!row) throw new Error("Material belum tersimpan.");
    return { ...item, row };
  });
  await tx.insert(materialInventory).values(
    paired.flatMap(({ input, row }) =>
      input.inventoryDefaults.map((item) => ({
        materialId: row.id,
        locationId: item.inventoryLocationId,
        currentStock: "0.00",
        reservedStock: "0.00",
        averageCost: "0.00",
        minimumStock: item.minimumStock.toFixed(2),
        lastPurchasePrice: item.lastPurchasePrice.toFixed(2),
      })),
    ),
  );
  await tx.insert(auditLog).values(
    paired.map(({ input, source, row }) => ({
      userId,
      action: "CREATE_MATERIAL_WITH_INVENTORY_DEFAULTS",
      targetTable: "material_master",
      targetId: row.id,
      newState: JSON.stringify({
        material: row,
        inventoryDefaults: input.inventoryDefaults,
        source,
      }),
    })),
  );
  await recordReadinessMilestonesTx({
    tx,
    actorUserId: userId,
    changedItem: "material_foundation",
  });
  return paired.map(({ row }) => row);
}
export async function createMaterialMasterTx(
  tx: FinanceTransaction,
  userId: string,
  input: CreateMaterialWithInventoryDefaultsInput,
  source?: unknown,
): Promise<typeof materialMaster.$inferSelect> {
  const [created] = await createMaterialMastersTx(tx, userId, [{ input, source }]);
  return created;
}
