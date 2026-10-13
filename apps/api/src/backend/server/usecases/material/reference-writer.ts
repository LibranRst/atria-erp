import { and, eq } from "drizzle-orm";
import {
  auditLog,
  inventoryLocation,
  materialCategory,
  materialInventory,
  materialMaster,
  vendor,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import { lockMaterialCatalog } from "./master-writer";
export async function createMaterialCategoryTx(
  tx: FinanceTransaction,
  userId: string,
  input: { name: string; description?: string | null },
): Promise<typeof materialCategory.$inferSelect> {
  await lockMaterialCatalog(tx);
  const [created] = await tx
    .insert(materialCategory)
    .values({ name: input.name.trim(), description: input.description?.trim() || null })
    .returning();
  await tx.insert(auditLog).values({
    userId,
    action: "CREATE_MATERIAL_CATEGORY_SETTING",
    targetTable: "material_category",
    targetId: created.id,
    newState: JSON.stringify(created),
  });
  return created;
}
export async function createInventoryLocationTx(
  tx: FinanceTransaction,
  userId: string,
  input: { name: string; description?: string | null },
): Promise<typeof inventoryLocation.$inferSelect> {
  await lockMaterialCatalog(tx);
  const [created] = await tx
    .insert(inventoryLocation)
    .values({ name: input.name.trim(), description: input.description?.trim() || null })
    .returning();
  const materials = await tx.query.materialMaster.findMany({
    where: and(eq(materialMaster.tenantId, INSTANCE_TENANT_ID), eq(materialMaster.isActive, true)),
    columns: { id: true },
  });
  if (materials.length)
    await tx
      .insert(materialInventory)
      .values(materials.map((material) => ({ materialId: material.id, locationId: created.id })));
  await tx.insert(auditLog).values({
    userId,
    action: "CREATE_INVENTORY_LOCATION",
    targetTable: "inventory_location",
    targetId: created.id,
    newState: JSON.stringify({ ...created, initializedMaterials: materials.length }),
  });
  await recordReadinessMilestonesTx({
    tx,
    actorUserId: userId,
    changedItem: "material_foundation",
  });
  return created;
}
export async function createVendorTx(
  tx: FinanceTransaction,
  userId: string,
  input: typeof vendor.$inferInsert,
): Promise<typeof vendor.$inferSelect> {
  await lockMaterialCatalog(tx);
  const [created] = await tx.insert(vendor).values(input).returning();
  await tx.insert(auditLog).values({
    userId,
    action: "CREATE_VENDOR",
    targetTable: "vendor",
    targetId: created.id,
    newState: JSON.stringify(created),
  });
  return created;
}
