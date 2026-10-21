import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  inventoryLocation,
  auditLog,
  materialInventory,
  stockCount,
  stockCountItem,
  stockMovement,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";

import {
  rejectStockCountSchema,
  saveStockCountSchema,
  stockCountIdSchema,
} from "@atria/core/validations/warehouse";

type Count = typeof stockCount.$inferSelect;
export async function saveStockCountTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<Count> {
  if (!actorCan(actor, "create:stock_count"))
    throw new Error("FORBIDDEN: Izin stock opname diperlukan.");
  const input = saveStockCountSchema.parse(raw);
  if (input.stockCountId)
    await tx
      .select()
      .from(stockCount)
      .where(
        and(eq(stockCount.id, input.stockCountId), eq(stockCount.tenantId, INSTANCE_TENANT_ID)),
      )
      .for("update");
  const [location] = await tx
    .select()
    .from(inventoryLocation)
    .where(
      and(
        eq(inventoryLocation.id, input.inventoryLocationId),
        eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!location || !location.isActive) throw new Error("Lokasi stock opname tidak tersedia.");

  let header: Count;
  if (input.stockCountId) {
    const [existing] = await tx
      .select()
      .from(stockCount)
      .where(
        and(eq(stockCount.id, input.stockCountId), eq(stockCount.tenantId, INSTANCE_TENANT_ID)),
      )
      .for("update");
    if (!existing || existing.status !== "DRAFT")
      throw new Error("Hanya stock count DRAFT yang dapat diubah.");
    if (existing.createdById !== actor.userId)
      throw new Error("FORBIDDEN: Draft stock opname hanya dapat diubah oleh pembuatnya.");
    [header] = await tx
      .update(stockCount)
      .set({
        countNumber: input.countNumber,
        inventoryLocationId: input.inventoryLocationId,
        countedAt: input.countedAt,
        note: input.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(stockCount.id, existing.id))
      .returning();
    await tx.delete(stockCountItem).where(eq(stockCountItem.stockCountId, existing.id));
  } else {
    [header] = await tx
      .insert(stockCount)
      .values({
        countNumber: input.countNumber,
        inventoryLocationId: input.inventoryLocationId,
        countedAt: input.countedAt,
        note: input.note ?? null,
        createdById: actor.userId,
      })
      .returning();
  }
  const inventories = await tx
    .select()
    .from(materialInventory)
    .where(
      and(
        eq(materialInventory.locationId, input.inventoryLocationId),
        eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        inArray(
          materialInventory.materialId,
          input.items.map((item) => item.materialId),
        ),
      ),
    )
    .orderBy(asc(materialInventory.id))
    .for("update");
  if (inventories.length !== input.items.length)
    throw new Error("Inventory material belum tersedia di lokasi count.");
  await tx.insert(stockCountItem).values(
    input.items.map((item) => {
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
    userId: actor.userId,
    action: "SAVE_STOCK_COUNT_DRAFT",
    targetTable: "stock_count",
    targetId: header.id,
    newState: JSON.stringify({ ...header, items: input.items }),
  });
  return header;
}
export async function approveStockCountTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<Count> {
  if (!actorCan(actor, "approve:stock_count"))
    throw new Error("FORBIDDEN: Izin stock opname diperlukan.");
  const input = stockCountIdSchema.parse(raw);
  await assertOperationalStockReadiness(tx);
  const canEmergencyOverride = actorCan(actor, "override:self_approval");

  // An unchanged count does not update inventory, so inventory locks alone
  // cannot stop two approvals from writing two decisions and audits.
  const [header] = await tx
    .select()
    .from(stockCount)
    .where(and(eq(stockCount.id, input.stockCountId), eq(stockCount.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!header || header.status !== "PENDING_APPROVAL")
    throw new Error("Stock count belum siap approval.");
  const items = await tx.query.stockCountItem.findMany({
    where: eq(stockCountItem.stockCountId, header.id),
    orderBy: [asc(stockCountItem.materialId), asc(stockCountItem.id)],
  });
  const count = { ...header, items };
  const selfApproval = count.createdById === actor.userId;
  if (selfApproval && !(canEmergencyOverride && input.emergencyOverride && input.reason))
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
          eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
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
          createdById: actor.userId,
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
      approvedById: actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stockCount.id, count.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: selfApproval ? "EMERGENCY_SELF_APPROVE_STOCK_COUNT" : "APPROVE_STOCK_COUNT",
    targetTable: "stock_count",
    targetId: count.id,
    originalState: JSON.stringify(count),
    newState: JSON.stringify({
      ...updated,
      emergencyReason: selfApproval ? input.reason : null,
    }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "stock_count",
    referenceId: updated.id,
    stage: "POSTED",
    title: "Hasil hitung stok disetujui",
    message: "Hasil penghitungan telah diterapkan ke stok.",
    permission: "create:stock_count",
    actionUrl: "/materials",
    actorId: actor.userId,
  });
  return updated;
}
export async function submitStockCountTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<Count> {
  if (!actorCan(actor, "create:stock_count"))
    throw new Error("FORBIDDEN: Izin stock opname diperlukan.");
  const input = stockCountIdSchema.parse(raw);
  const [existing] = await tx
    .select()
    .from(stockCount)
    .where(and(eq(stockCount.id, input.stockCountId), eq(stockCount.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!existing || existing.status !== "DRAFT") throw new Error("Stock count bukan Draft.");
  if (existing.createdById !== actor.userId)
    throw new Error("FORBIDDEN: Draft hanya dapat diajukan pembuatnya.");

  const rows = await tx
    .update(stockCount)
    .set({ status: "PENDING_APPROVAL", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(stockCount.id, existing.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "SUBMIT_STOCK_COUNT",
    targetTable: "stock_count",
    targetId: existing.id,
    originalState: JSON.stringify(existing),
    newState: JSON.stringify(rows[0]),
  });
  await recordNotificationEvent(tx, {
    referenceType: "stock_count",
    referenceId: rows[0].id,
    stage: `${rows[0].status}:${rows[0].updatedAt.toISOString()}`,
    title:
      rows[0].status === "PENDING_APPROVAL"
        ? "Hitung stok menunggu persetujuan"
        : "Hitung stok ditolak",
    message: "Periksa hasil penghitungan stok.",
    permission:
      rows[0].status === "PENDING_APPROVAL" ? "approve:stock_count" : "create:stock_count",
    actionRequired: rows[0].status === "PENDING_APPROVAL",
    actionUrl: "/materials",
    actorId: actor.userId,
  });
  return rows[0];
}
export async function rejectStockCountTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<Count> {
  if (!actorCan(actor, "approve:stock_count"))
    throw new Error("FORBIDDEN: Izin stock opname diperlukan.");
  const input = rejectStockCountSchema.parse(raw);
  const [existing] = await tx
    .select()
    .from(stockCount)
    .where(and(eq(stockCount.id, input.stockCountId), eq(stockCount.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!existing || existing.status !== "PENDING_APPROVAL")
    throw new Error("Stock count belum siap ditolak.");
  const rows = await tx
    .update(stockCount)
    .set({
      status: "REJECTED",
      rejectionReason: input.reason,
      approvedById: actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stockCount.id, existing.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "REJECT_STOCK_COUNT",
    targetTable: "stock_count",
    targetId: existing.id,
    originalState: JSON.stringify(existing),
    newState: JSON.stringify(rows[0]),
  });
  await recordNotificationEvent(tx, {
    referenceType: "stock_count",
    referenceId: rows[0].id,
    stage: `${rows[0].status}:${rows[0].updatedAt.toISOString()}`,
    title:
      rows[0].status === "PENDING_APPROVAL"
        ? "Hitung stok menunggu persetujuan"
        : "Hitung stok ditolak",
    message: "Periksa hasil penghitungan stok.",
    permission:
      rows[0].status === "PENDING_APPROVAL" ? "approve:stock_count" : "create:stock_count",
    actionRequired: rows[0].status === "PENDING_APPROVAL",
    actionUrl: "/materials",
    actorId: actor.userId,
  });
  return rows[0];
}
