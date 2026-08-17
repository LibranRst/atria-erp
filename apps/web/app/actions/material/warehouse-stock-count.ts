"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  materialInventory,
  stockCount,
  stockCountItem,
  stockMovement,
} from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  rejectStockCountSchema,
  saveStockCountSchema,
  stockCountIdSchema,
} from "@/lib/validations/warehouse";
import {
  getWarehouseUser as user,
  refreshWarehouse as refresh,
  warehouseFailure as failure,
} from "./warehouse-action-utils";

type Count = typeof stockCount.$inferSelect;
export async function saveStockCount(input: unknown): Promise<ActionResponse<Count>> {
  const parsed = saveStockCountSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Stock count tidak valid.",
      },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "create:stock_count");
    const result = await db.transaction(async (tx) => {
      let header: Count;
      if (parsed.data.stockCountId) {
        const existing = await tx.query.stockCount.findFirst({
          where: eq(stockCount.id, parsed.data.stockCountId),
        });
        if (!existing || existing.status !== "DRAFT")
          throw new Error("Hanya stock count DRAFT yang dapat diubah.");
        if (existing.createdById !== actor.id)
          throw new Error("FORBIDDEN: Draft stock opname hanya dapat diubah oleh pembuatnya.");
        [header] = await tx
          .update(stockCount)
          .set({
            countNumber: parsed.data.countNumber,
            inventoryLocationId: parsed.data.inventoryLocationId,
            countedAt: parsed.data.countedAt,
            note: parsed.data.note ?? null,
            updatedAt: new Date(),
          })
          .where(eq(stockCount.id, existing.id))
          .returning();
        await tx.delete(stockCountItem).where(eq(stockCountItem.stockCountId, existing.id));
      } else {
        [header] = await tx
          .insert(stockCount)
          .values({
            countNumber: parsed.data.countNumber,
            inventoryLocationId: parsed.data.inventoryLocationId,
            countedAt: parsed.data.countedAt,
            note: parsed.data.note ?? null,
            createdById: actor.id,
          })
          .returning();
      }
      const inventories = await tx.query.materialInventory.findMany({
        where: and(
          eq(materialInventory.locationId, parsed.data.inventoryLocationId),
          inArray(
            materialInventory.materialId,
            parsed.data.items.map((item) => item.materialId),
          ),
        ),
      });
      if (inventories.length !== parsed.data.items.length)
        throw new Error("Inventory material belum tersedia di lokasi count.");
      await tx.insert(stockCountItem).values(
        parsed.data.items.map((item) => {
          const inventory = inventories.find((row) => row.materialId === item.materialId)!;
          return {
            stockCountId: header.id,
            materialId: item.materialId,
            systemQuantity: inventory.currentStock,
            countedQuantity: item.countedQuantity.toFixed(2),
            varianceQuantity: (item.countedQuantity - Number(inventory.currentStock)).toFixed(2),
            unitCost: inventory.averageCost,
          };
        }),
      );
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "SAVE_STOCK_COUNT_DRAFT",
        targetTable: "stock_count",
        targetId: header.id,
        newState: JSON.stringify({ ...header, items: parsed.data.items }),
      });
      return header;
    });
    refresh();
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Gagal menyimpan stock count.");
  }
}

export async function submitStockCount(input: unknown): Promise<ActionResponse<Count>> {
  return changeCountStatus(input, "PENDING_APPROVAL");
}
async function changeCountStatus(
  input: unknown,
  status: "PENDING_APPROVAL",
): Promise<ActionResponse<Count>> {
  const parsed = stockCountIdSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Stock count tidak valid." },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "create:stock_count");
    const existing = await db.query.stockCount.findFirst({
      where: eq(stockCount.id, parsed.data.stockCountId),
    });
    if (!existing || existing.status !== "DRAFT") throw new Error("Stock count bukan DRAFT.");
    if (existing.createdById !== actor.id)
      throw new Error("FORBIDDEN: Draft stock opname hanya dapat dikirim oleh pembuatnya.");
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(stockCount)
        .set({ status, submittedAt: new Date(), updatedAt: new Date() })
        .where(eq(stockCount.id, existing.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "SUBMIT_STOCK_COUNT",
        targetTable: "stock_count",
        targetId: existing.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify(rows[0]),
      });
      return rows;
    });
    refresh();
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal submit stock count.");
  }
}

export async function approveStockCount(input: unknown): Promise<ActionResponse<Count>> {
  const parsed = stockCountIdSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Stock count tidak valid." },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "approve:stock_count");
    const roleName = await resolveRoleName(actor.roleId ?? "");
    const result = await db.transaction(async (tx) => {
      const count = await tx.query.stockCount.findFirst({
        where: eq(stockCount.id, parsed.data.stockCountId),
        with: { items: true },
      });
      if (!count || count.status !== "PENDING_APPROVAL")
        throw new Error("Stock count belum siap approval.");
      const selfApproval = count.createdById === actor.id;
      if (
        selfApproval &&
        !(roleName === "OWNER" && parsed.data.emergencyOverride && parsed.data.reason)
      )
        throw new Error(
          "MAKER_CHECKER_REQUIRED: Stock count harus disetujui user lain. Owner dapat memakai emergency override dengan alasan.",
        );
      for (const item of count.items) {
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(
            and(
              eq(materialInventory.materialId, item.materialId),
              eq(materialInventory.locationId, count.inventoryLocationId),
            ),
          )
          .for("update");
        if (!inventory || Number(inventory.currentStock) !== Number(item.systemQuantity))
          throw new Error("Stok berubah sejak terakhir dihitung. Lakukan stock opname ulang.");
        if (Number(item.countedQuantity) < Number(inventory.reservedStock))
          throw new Error(
            "Counted stock lebih kecil dari reserved stock. Rekonsiliasi reservation dahulu.",
          );
        const variance = Number(item.varianceQuantity);
        let movementId: string | null = null;
        if (variance !== 0) {
          await tx
            .update(materialInventory)
            .set({ currentStock: item.countedQuantity, updatedAt: new Date() })
            .where(eq(materialInventory.id, inventory.id));
          const [movement] = await tx
            .insert(stockMovement)
            .values({
              materialId: item.materialId,
              inventoryLocationId: count.inventoryLocationId,
              movementType: "STOCK_COUNT_ADJUSTMENT",
              movementDirection: variance > 0 ? "IN" : "OUT",
              referenceType: "STOCK_COUNT",
              referenceId: count.id,
              quantity: Math.abs(variance).toFixed(2),
              unitCost: item.unitCost,
              note: count.note ?? `Stock count ${count.countNumber}`,
              createdById: actor.id,
            })
            .returning();
          movementId = movement.id;
          await tx
            .update(stockCountItem)
            .set({ stockMovementId: movementId })
            .where(eq(stockCountItem.id, item.id));
        }
      }
      const [updated] = await tx
        .update(stockCount)
        .set({
          status: "POSTED",
          approvedById: actor.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stockCount.id, count.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: selfApproval ? "EMERGENCY_SELF_APPROVE_STOCK_COUNT" : "APPROVE_STOCK_COUNT",
        targetTable: "stock_count",
        targetId: count.id,
        originalState: JSON.stringify(count),
        newState: JSON.stringify({
          ...updated,
          emergencyReason: selfApproval ? parsed.data.reason : null,
        }),
      });
      return updated;
    });
    refresh();
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Gagal approve stock count.");
  }
}

export async function rejectStockCount(input: unknown): Promise<ActionResponse<Count>> {
  const parsed = rejectStockCountSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Penolakan tidak valid.",
      },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "approve:stock_count");
    const [updated] = await db.transaction(async (tx) => {
      const existing = await tx.query.stockCount.findFirst({
        where: eq(stockCount.id, parsed.data.stockCountId),
      });
      if (!existing || existing.status !== "PENDING_APPROVAL")
        throw new Error("Stock count belum siap ditolak.");
      const rows = await tx
        .update(stockCount)
        .set({
          status: "REJECTED",
          rejectionReason: parsed.data.reason,
          approvedById: actor.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stockCount.id, existing.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "REJECT_STOCK_COUNT",
        targetTable: "stock_count",
        targetId: existing.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify(rows[0]),
      });
      return rows;
    });
    refresh();
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal reject stock count.");
  }
}
