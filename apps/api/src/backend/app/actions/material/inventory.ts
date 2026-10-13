import {
  lockMaterialCatalog,
  assertMaterialIdentityAvailable,
} from "@backend/server/usecases/material/master-writer";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { db } from "@backend/db";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import {
  auditLog,
  materialCategory,
  materialInventory,
  materialMaster,
  projectRapItem,
  stockMovement,
} from "@backend/db/schema";
import { and, eq } from "drizzle-orm";
import { assertPermission } from "@backend/lib/auth/permissions";
import { ActionResponse } from "@atria/core/types/action-response";
import {
  AdjustMaterialStockInput,
  CreateMaterialCategoryInput,
  CreateMaterialInput,
  MaterialInventoryQueryInput,
  RecordStockInInput,
  ReserveMaterialInput,
  ReturnMaterialInput,
  UseMaterialInput,
  WasteMaterialInput,
  createMaterialCategorySchema,
  createMaterialSchema,
  materialInventoryQuerySchema,
} from "@atria/core/validations/material";
import { calculateInventoryStatus, getSessionUser } from "./inventory-utils";
import {
  adjustMaterialStock as adjustMaterialStockWrite,
  recordStockIn as recordStockInWrite,
  reserveMaterialForProject as reserveMaterialForProjectWrite,
  returnMaterialFromProject as returnMaterialFromProjectWrite,
  useMaterialForProject as recordMaterialUsageForProject,
  wasteMaterialForProject as wasteMaterialForProjectWrite,
} from "./inventory-movements";

export interface MaterialInventoryRow {
  readonly inventoryId: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly categoryName: string;
  readonly specification: string | null;
  readonly brand: string | null;
  readonly code: string | null;
  readonly color: string | null;
  readonly unit: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly currentStock: number;
  readonly reservedStock: number;
  readonly availableStock: number;
  readonly minimumStock: number;
  readonly averageCost: number;
  readonly lastPurchasePrice: number;
  readonly status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | "RESERVED";
}

export async function createMaterialCategory(
  input: CreateMaterialCategoryInput,
): Promise<ActionResponse<typeof materialCategory.$inferSelect>> {
  const validation = createMaterialCategorySchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data kategori material tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "create:material");
    const [created] = await db.insert(materialCategory).values(validation.data).returning();
    revalidatePath("/materials");
    revalidatePath("/settings");
    return { success: true, data: created };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message: error instanceof Error ? error.message : "Gagal membuat kategori material.",
      },
    };
  }
}

export async function createMaterial(
  input: CreateMaterialInput,
): Promise<ActionResponse<typeof materialMaster.$inferSelect>> {
  const validation = createMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data material tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "create:material");
    const created = await db.transaction(async (tx) => {
      await lockMaterialCatalog(tx);
      await assertMaterialIdentityAvailable(tx, validation.data.name, validation.data.code);
      const [created] = await tx
        .insert(materialMaster)
        .values({
          ...validation.data,
          defaultVendorId: validation.data.defaultVendorId ?? null,
          specification: validation.data.specification ?? null,
          brand: validation.data.brand ?? null,
          code: validation.data.code ?? null,
          color: validation.data.color ?? null,
        })
        .returning();
      await tx.insert(auditLog).values({
        userId: sessionResult.data.user.id,
        action: "CREATE_MATERIAL",
        targetTable: "material_master",
        targetId: created.id,
        newState: JSON.stringify(created),
      });
      return created;
    });

    revalidatePath("/materials");
    revalidatePath("/settings");
    return { success: true, data: created };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message: error instanceof Error ? error.message : "Gagal membuat material.",
      },
    };
  }
}

export async function getMaterialInventory(
  input: MaterialInventoryQueryInput = {},
): Promise<ActionResponse<MaterialInventoryRow[]>> {
  const validation = materialInventoryQuerySchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Filter inventory tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "view:inventory");

    const filters = [];
    if (validation.data.materialId)
      filters.push(eq(materialInventory.materialId, validation.data.materialId));
    if (validation.data.locationId)
      filters.push(eq(materialInventory.locationId, validation.data.locationId));

    const inventoryRows = await db.query.materialInventory.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      with: {
        material: {
          with: {
            category: true,
          },
        },
        location: true,
      },
    });

    const search = validation.data.search?.toLowerCase().trim();
    const rows = inventoryRows
      .filter((row) => {
        if (!search) return true;
        const haystack = [
          row.material.name,
          row.material.specification ?? "",
          row.material.brand ?? "",
          row.material.code ?? "",
          row.material.color ?? "",
          row.material.category.name,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .map((row): MaterialInventoryRow => {
        const currentStock = Number(row.currentStock);
        const reservedStock = Number(row.reservedStock);
        const availableStock = currentStock - reservedStock;

        return {
          inventoryId: row.id,
          materialId: row.materialId,
          materialName: row.material.name,
          categoryName: row.material.category.name,
          specification: row.material.specification,
          brand: row.material.brand,
          code: row.material.code,
          color: row.material.color,
          unit: row.material.unit,
          locationId: row.locationId,
          locationName: row.location.name,
          currentStock,
          reservedStock,
          availableStock,
          minimumStock: Number(row.minimumStock),
          averageCost: Number(row.averageCost),
          lastPurchasePrice: Number(row.lastPurchasePrice),
          status: calculateInventoryStatus(row),
        };
      });

    return { success: true, data: rows };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Gagal mengambil inventory material.",
      },
    };
  }
}

export async function recordStockIn(
  input: RecordStockInInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const result = await recordStockInWrite(input);
  if (result.success) {
    revalidatePath("/materials");
    if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  }
  return result;
}

export async function reserveMaterialForProject(
  input: ReserveMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const result = await reserveMaterialForProjectWrite(input);
  if (result.success) {
    revalidatePath("/materials");
    if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  }
  return result;
}

export async function wasteMaterialForProject(
  input: WasteMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const result = await wasteMaterialForProjectWrite(input);
  if (result.success) {
    revalidatePath("/materials");
    if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  }
  return result;
}

export async function useMaterialForProject(
  input: UseMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const result = await recordMaterialUsageForProject(input);
  if (result.success) {
    revalidatePath("/materials");
    if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  }
  return result;
}

export async function returnMaterialFromProject(
  input: ReturnMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const result = await returnMaterialFromProjectWrite(input);
  if (result.success) {
    revalidatePath("/materials");
    if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  }
  return result;
}

export async function adjustMaterialStock(
  input: AdjustMaterialStockInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const result = await adjustMaterialStockWrite(input);
  if (result.success) {
    revalidatePath("/materials");
    if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  }
  return result;
}

export interface MaterialShortageRow {
  readonly projectRapItemId: string;
  readonly projectRapId: string;
  readonly materialId: string | null;
  readonly materialName: string;
  readonly area: string;
  readonly requiredQuantity: number;
  readonly bufferQuantity: number;
  readonly totalQuantity: number;
  readonly availableStock: number;
  readonly needToBuy: number;
  readonly estimatedTotalCost: number;
  readonly status: string;
}

export async function getMaterialShortages(
  projectRapId?: string,
): Promise<ActionResponse<MaterialShortageRow[]>> {
  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "view:rap");

    const rapItems = await db.query.projectRapItem.findMany({
      where: projectRapId ? eq(projectRapItem.projectRapId, projectRapId) : undefined,
      with: {
        rap: true,
        stockMovements: true,
        material: {
          with: {
            inventory: true,
          },
        },
      },
    });

    const rows = rapItems
      .filter((item) => item.rap.status !== "SUPERSEDED")
      .map((item): MaterialShortageRow => {
        const totalQuantity = Number(item.totalQuantity);
        const availableStock =
          item.material?.inventory.reduce((sum, inv) => {
            return sum + Number(inv.currentStock) - Number(inv.reservedStock);
          }, 0) ?? 0;

        const materialProjection = projectMaterialProjection(
          item.stockMovements ?? [],
          totalQuantity,
        );

        return {
          projectRapItemId: item.id,
          projectRapId: item.projectRapId,
          materialId: item.materialId,
          materialName: item.material?.name ?? item.name,
          area: item.area,
          requiredQuantity: Number(item.requiredQuantity),
          bufferQuantity: Number(item.bufferQuantity),
          totalQuantity,
          availableStock,
          needToBuy: materialProjection.needToBuy,
          estimatedTotalCost: Number(item.estimatedTotalCost),
          status:
            item.status === "PLANNED" || item.status === "DRAFT"
              ? item.status
              : materialProjection.needToBuy > 0
                ? "SHORTAGE"
                : "READY",
        };
      });

    return { success: true, data: rows };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Gagal mengambil shortage material.",
      },
    };
  }
}
