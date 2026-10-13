import { and, asc, eq, gt, ne } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  auditLog,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  materialInventory,
  stockMovement,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import {
  createInventoryOpeningSchema,
  decideInventoryOpeningSchema,
  reverseInventoryOpeningSchema,
  type CreateInventoryOpeningInput,
  type DecideInventoryOpeningInput,
  type ReverseInventoryOpeningInput,
} from "@atria/core/validations/material";
import type { OpeningBatch } from "@backend/app/actions/material/opening-inventory-types";
export async function createInventoryOpeningTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: CreateInventoryOpeningInput,
): Promise<OpeningBatch> {
  if (!actor.isActive || !actorCan(actor, "create:opening_inventory"))
    throw new Error("FORBIDDEN: Izin saldo awal stok tidak tersedia.");
  const input = createInventoryOpeningSchema.parse(raw);

  const batchNumber =
    input.batchNumber?.trim() ||
    `SA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const duplicate = await tx.query.inventoryOpeningBatch.findFirst({
    where: and(
      eq(inventoryOpeningBatch.batchNumber, batchNumber),
      eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (duplicate) throw new Error("Referensi saldo awal sudah digunakan. Coba ajukan kembali.");
  const inventoryIds = input.items.map((item) => item.materialInventoryId).toSorted();
  for (const inventoryId of inventoryIds) {
    const [inventory] = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.id, inventoryId),
          eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    if (!inventory) throw new Error("Inventory material tidak ditemukan.");
    const priorMovement = await tx.query.stockMovement.findFirst({
      where: and(
        eq(stockMovement.materialId, inventory.materialId),
        eq(stockMovement.inventoryLocationId, inventory.locationId),
      ),
    });
    if (
      Number(inventory.currentStock) !== 0 ||
      Number(inventory.reservedStock) !== 0 ||
      priorMovement
    ) {
      throw new Error("INVENTORY_ALREADY_ACTIVE");
    }
    const [pendingOpening] = await tx
      .select({ id: inventoryOpeningItem.id })
      .from(inventoryOpeningItem)
      .innerJoin(inventoryOpeningBatch, eq(inventoryOpeningBatch.id, inventoryOpeningItem.batchId))
      .where(
        and(
          eq(inventoryOpeningItem.materialInventoryId, inventoryId),
          eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
        ),
      )
      .limit(1);
    if (pendingOpening) throw new Error("OPENING_ALREADY_PENDING");
  }
  const [batch] = await tx
    .insert(inventoryOpeningBatch)
    .values({
      batchNumber,
      cutoverDate: input.cutoverDate,
      status: "PENDING_APPROVAL",
      note: input.note,
      referenceNumber: input.referenceNumber?.trim() || null,
      requestedById: actor.userId,
    })
    .returning();
  await tx.insert(inventoryOpeningItem).values(
    input.items.map((item) => ({
      batchId: batch.id,
      materialInventoryId: item.materialInventoryId,
      quantity: item.quantity.toFixed(2),
      unitCost: item.unitCost.toFixed(2),
    })),
  );
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "REQUEST_INVENTORY_OPENING",
    targetTable: "inventory_opening_batch",
    targetId: batch.id,
    newState: JSON.stringify({ ...batch, items: input.items }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "inventory_opening",
    referenceId: batch.id,
    stage: "PENDING_APPROVAL",
    title: "Saldo awal stok menunggu persetujuan",
    message: `${batch.batchNumber} siap ditinjau.`,
    permission: "approve:opening_inventory",
    actionRequired: true,
    actionUrl: "/approvals",
    actorId: actor.userId,
  });
  return batch;
}

export async function decideInventoryOpeningTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: DecideInventoryOpeningInput,
): Promise<OpeningBatch> {
  if (!actor.isActive || !actorCan(actor, "approve:opening_inventory"))
    throw new Error("FORBIDDEN: Izin saldo awal stok tidak tersedia.");
  const input = decideInventoryOpeningSchema.parse(raw);

  const [locked] = await tx
    .select()
    .from(inventoryOpeningBatch)
    .where(
      and(
        eq(inventoryOpeningBatch.id, input.batchId),
        eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!locked) throw new Error("OPENING_NOT_FOUND");
  if (locked.status !== "PENDING_APPROVAL") {
    throw new Error("Batch saldo awal sudah diputuskan.");
  }
  if (input.decision === "REJECT") {
    const [rejected] = await tx
      .update(inventoryOpeningBatch)
      .set({
        status: "REJECTED",
        decisionReason: input.reason,
        rejectedReason: input.reason,
        approvedById: actor.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryOpeningBatch.id, locked.id))
      .returning();
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "REJECT_INVENTORY_OPENING",
      targetTable: "inventory_opening_batch",
      targetId: locked.id,
      originalState: JSON.stringify(locked),
      newState: JSON.stringify(rejected),
    });
    await recordNotificationEvent(tx, {
      referenceType: "inventory_opening",
      referenceId: rejected.id,
      stage: "REJECTED",
      title: "Saldo awal stok perlu diperbaiki",
      message: input.reason,
      permission: "view:inventory",
      recipients: [locked.requestedById],
      actionUrl: "/materials/opening",
      actorId: actor.userId,
    });
    return rejected;
  }
  if (locked.requestedById === actor.userId) {
    throw new Error("MAKER_CHECKER_REQUIRED");
  }
  const items = await tx.query.inventoryOpeningItem.findMany({
    where: eq(inventoryOpeningItem.batchId, locked.id),
    orderBy: [asc(inventoryOpeningItem.materialInventoryId)],
  });
  for (const item of items) {
    const [inventory] = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.id, item.materialInventoryId),
          eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    if (!inventory) throw new Error("Inventory material tidak ditemukan.");
    const priorMovement = await tx.query.stockMovement.findFirst({
      where: and(
        eq(stockMovement.materialId, inventory.materialId),
        eq(stockMovement.inventoryLocationId, inventory.locationId),
      ),
    });
    if (
      Number(inventory.currentStock) !== 0 ||
      Number(inventory.reservedStock) !== 0 ||
      priorMovement
    ) {
      throw new Error("INVENTORY_ALREADY_ACTIVE");
    }
    await tx
      .update(materialInventory)
      .set({
        currentStock: item.quantity,
        averageCost: item.unitCost,
        lastPurchasePrice: item.unitCost,
        updatedAt: new Date(),
      })
      .where(eq(materialInventory.id, inventory.id));
    const [movement] = await tx
      .insert(stockMovement)
      .values({
        materialId: inventory.materialId,
        inventoryLocationId: inventory.locationId,
        movementType: "OPENING_BALANCE",
        movementDirection: "IN",
        referenceType: "INVENTORY_OPENING",
        referenceId: locked.id,
        quantity: item.quantity,
        unitCost: item.unitCost,
        note: locked.note,
        createdById: actor.userId,
      })
      .returning();
    await tx
      .update(inventoryOpeningItem)
      .set({ stockMovementId: movement.id })
      .where(eq(inventoryOpeningItem.id, item.id));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "POST_INVENTORY_OPENING_ITEM",
      targetTable: "material_inventory",
      targetId: inventory.id,
      originalState: JSON.stringify(inventory),
      newState: JSON.stringify({
        currentStock: item.quantity,
        averageCost: item.unitCost,
        stockMovementId: movement.id,
      }),
    });
  }
  const [posted] = await tx
    .update(inventoryOpeningBatch)
    .set({
      status: "POSTED",
      decisionReason: input.reason,
      approvedById: actor.userId,
      approvedAt: new Date(),
      postedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inventoryOpeningBatch.id, locked.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "APPROVE_INVENTORY_OPENING",
    targetTable: "inventory_opening_batch",
    targetId: locked.id,
    originalState: JSON.stringify(locked),
    newState: JSON.stringify({ ...posted, decisionReason: input.reason }),
  });
  await recordReadinessMilestonesTx({
    tx,
    actorUserId: actor.userId,
    changedItem: "initial_stock",
  });
  await recordNotificationEvent(tx, {
    referenceType: "inventory_opening",
    referenceId: posted.id,
    stage: "POSTED",
    title: "Saldo awal stok disetujui",
    message: `${posted.batchNumber} sudah diposting ke inventory.`,
    permission: "view:inventory",
    recipients: [locked.requestedById],
    actionUrl: "/materials/opening",
    actorId: actor.userId,
  });
  return posted;
}

export async function reverseInventoryOpeningTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: ReverseInventoryOpeningInput,
): Promise<OpeningBatch> {
  if (!actor.isActive || !actorCan(actor, "reverse:opening_inventory"))
    throw new Error("FORBIDDEN: Izin saldo awal stok tidak tersedia.");
  const input = reverseInventoryOpeningSchema.parse(raw);

  const [locked] = await tx
    .select()
    .from(inventoryOpeningBatch)
    .where(
      and(
        eq(inventoryOpeningBatch.id, input.batchId),
        eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!locked) throw new Error("OPENING_NOT_FOUND");
  if (locked.status !== "POSTED") {
    throw new Error("Hanya saldo awal berstatus sudah diposting yang dapat dibalik.");
  }
  const items = await tx.query.inventoryOpeningItem.findMany({
    where: eq(inventoryOpeningItem.batchId, locked.id),
    with: { stockMovement: true },
    orderBy: [asc(inventoryOpeningItem.materialInventoryId)],
  });
  for (const item of items) {
    if (!item.stockMovement) throw new Error("Pergerakan saldo awal tidak ditemukan.");
    const [inventory] = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.id, item.materialInventoryId),
          eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    // Serialize history checks with all stock writers. Date values retain
    // milliseconds while PostgreSQL may retain microseconds, so explicitly
    // exclude this opening rather than comparing it to its rounded date.
    const later = await tx.query.stockMovement.findFirst({
      where: and(
        eq(stockMovement.materialId, item.stockMovement.materialId),
        eq(stockMovement.inventoryLocationId, item.stockMovement.inventoryLocationId),
        ne(stockMovement.id, item.stockMovement.id),
        gt(stockMovement.createdAt, item.stockMovement.createdAt),
      ),
    });
    if (later) throw new Error("REVERSAL_HAS_LATER_MOVEMENT");
    if (
      !inventory ||
      Number(inventory.currentStock) !== Number(item.quantity) ||
      Number(inventory.reservedStock) !== 0
    ) {
      throw new Error("Saldo inventory sudah berubah dan tidak aman untuk reversal.");
    }
    await tx
      .update(materialInventory)
      .set({
        currentStock: "0.00",
        averageCost: "0.00",
        lastPurchasePrice: "0.00",
        updatedAt: new Date(),
      })
      .where(eq(materialInventory.id, inventory.id));
    const [movement] = await tx
      .insert(stockMovement)
      .values({
        materialId: inventory.materialId,
        inventoryLocationId: inventory.locationId,
        movementType: "OPENING_BALANCE_REVERSAL",
        movementDirection: "OUT",
        referenceType: "INVENTORY_OPENING",
        referenceId: locked.id,
        quantity: item.quantity,
        unitCost: item.unitCost,
        note: input.reason,
        createdById: actor.userId,
      })
      .returning();
    await tx
      .update(inventoryOpeningItem)
      .set({ reversalStockMovementId: movement.id })
      .where(eq(inventoryOpeningItem.id, item.id));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "REVERSE_INVENTORY_OPENING_ITEM",
      targetTable: "material_inventory",
      targetId: inventory.id,
      originalState: JSON.stringify(inventory),
      newState: JSON.stringify({
        currentStock: 0,
        averageCost: 0,
        reversalStockMovementId: movement.id,
      }),
    });
  }
  const [updated] = await tx
    .update(inventoryOpeningBatch)
    .set({
      status: "REVERSED",
      reversedById: actor.userId,
      reversedAt: new Date(),
      reversalReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(inventoryOpeningBatch.id, locked.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "REVERSE_INVENTORY_OPENING",
    targetTable: "inventory_opening_batch",
    targetId: locked.id,
    originalState: JSON.stringify(locked),
    newState: JSON.stringify(updated),
  });
  await recordNotificationEvent(tx, {
    referenceType: "inventory_opening",
    referenceId: updated.id,
    stage: "REVERSED",
    title: "Saldo awal stok dibalik",
    message: input.reason,
    permission: "view:inventory",
    recipients: [locked.requestedById],
    actionUrl: "/materials/opening",
    actorId: actor.userId,
  });
  return updated;
}
