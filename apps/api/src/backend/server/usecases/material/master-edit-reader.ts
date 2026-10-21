import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, materialCategory, materialMaster, vendor } from "@backend/db/schema";
import {
  materialEditSnapshotSchema,
  type MaterialEditSnapshot,
} from "@atria/core/ai/material-update";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { MaterialEditError } from "./master-editor";

export type MaterialEditTarget = {
  readonly materialId: string;
  readonly updatedAt: string;
  readonly snapshot: MaterialEditSnapshot;
};
export async function readMaterialEditTarget(
  materialId: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<MaterialEditTarget> {
  const material = await connection.query.materialMaster.findFirst({
    where: and(eq(materialMaster.id, materialId), eq(materialMaster.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!material) throw new MaterialEditError("NOT_FOUND", "Material tidak ditemukan.");
  const refs = await readMaterialEditReferences(
    material.categoryId,
    material.defaultVendorId,
    connection,
  );
  return {
    materialId,
    updatedAt: material.updatedAt.toISOString(),
    snapshot: materialEditSnapshotSchema.parse({ ...material, ...refs }),
  };
}
export async function readMaterialEditReferences(
  categoryId: string,
  vendorId: string | null,
  connection: Pick<typeof db, "query"> = db,
): Promise<{ categoryName: string; vendorName: string | null; vendorIsActive: boolean }> {
  const [category, supplier] = await Promise.all([
    connection.query.materialCategory.findFirst({
      where: and(
        eq(materialCategory.id, categoryId),
        eq(materialCategory.tenantId, INSTANCE_TENANT_ID),
      ),
    }),
    vendorId
      ? connection.query.vendor.findFirst({
          where: and(eq(vendor.id, vendorId), eq(vendor.tenantId, INSTANCE_TENANT_ID)),
        })
      : Promise.resolve(undefined),
  ]);
  if (!category)
    throw new MaterialEditError("VALIDATION_ERROR", "Kategori material tidak tersedia.");
  if (vendorId && !supplier)
    throw new MaterialEditError("VALIDATION_ERROR", "Vendor material tidak tersedia.");
  return {
    categoryName: category.name,
    vendorName: supplier?.name ?? null,
    vendorIsActive: supplier?.isActive ?? false,
  };
}
export async function lookupEditableMaterials(input: {
  readonly query?: string;
  readonly materialId?: string;
  readonly referenceQuery?: string;
}): Promise<{
  materials: readonly {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    isActive: boolean;
  }[];
  categories: readonly { id: string; name: string }[];
  vendors: readonly { id: string; name: string }[];
  hasMoreMaterials: boolean;
  hasMoreReferences: boolean;
  needsDisambiguation: boolean;
}> {
  const query = input.query?.trim();
  const referenceQuery = input.referenceQuery?.trim();
  const [materials, categories, vendors] = await Promise.all([
    referenceQuery && !query && !input.materialId
      ? Promise.resolve([])
      : db.query.materialMaster.findMany({
          where: and(
            eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
            input.materialId
              ? eq(materialMaster.id, input.materialId)
              : query
                ? or(
                    ilike(materialMaster.name, `%${query}%`),
                    ilike(materialMaster.code, `%${query}%`),
                  )
                : undefined,
          ),
          columns: { id: true, name: true, code: true, unit: true, isActive: true },
          orderBy: [asc(materialMaster.name)],
          limit: 21,
        }),
    db.query.materialCategory.findMany({
      where: and(
        eq(materialCategory.tenantId, INSTANCE_TENANT_ID),
        referenceQuery ? ilike(materialCategory.name, `%${referenceQuery}%`) : undefined,
      ),
      columns: { id: true, name: true },
      orderBy: [asc(materialCategory.name)],
      limit: 101,
    }),
    db.query.vendor.findMany({
      where: and(
        eq(vendor.tenantId, INSTANCE_TENANT_ID),
        eq(vendor.isActive, true),
        referenceQuery ? ilike(vendor.name, `%${referenceQuery}%`) : undefined,
      ),
      columns: { id: true, name: true },
      orderBy: [asc(vendor.name)],
      limit: 101,
    }),
  ]);
  return {
    materials: materials.slice(0, 20),
    categories: categories.slice(0, 100),
    vendors: vendors.slice(0, 100),
    hasMoreMaterials: materials.length > 20,
    hasMoreReferences: categories.length > 100 || vendors.length > 100,
    needsDisambiguation: materials.length > 1,
  };
}
