import { and, asc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  goodsReceipt,
  goodsReceiptItem,
  materialMaster,
  inventoryLocation,
  materialInventory,
  stockMovement,
  auditLog,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { calculateReceiptReversalValuation } from "@atria/core/material/stock-valuation";
import type { PermissionKey } from "@atria/core/auth/permissions";
export type ReceiptReversalTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ReceiptReversalAction =
  "RECEIPT_REVERSAL_REQUEST" | "RECEIPT_REVERSAL_APPROVE" | "RECEIPT_REVERSAL_REJECT";
export type ReceiptReversalInput = {
  action: ReceiptReversalAction;
  goodsReceiptId: string;
  reason?: string;
  emergencyOverride?: boolean;
};
export class ReceiptReversalError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function receiptReversalPermission(action: ReceiptReversalAction): PermissionKey {
  return action === "RECEIPT_REVERSAL_REQUEST"
    ? "request:goods_receipt_reversal"
    : "approve:goods_receipt_reversal";
}
export async function assertReceiptScope(
  reader: Pick<ReceiptReversalTx, "query">,
  actor: Actor,
  projectId: string,
): Promise<typeof project.$inferSelect> {
  const proj = await reader.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
  });
  if (!proj) throw new ReceiptReversalError("FORBIDDEN", "Proyek penerimaan di luar akses Anda.");
  // Explicit receipt rights retain warehouse NONE scope; ASSIGNED never expands.
  return proj;
}
export async function prepareReceiptReversalTx(
  tx: ReceiptReversalTx,
  actor: Actor,
  input: ReceiptReversalInput,
): Promise<{
  receipt: typeof goodsReceipt.$inferSelect;
  project: typeof project.$inferSelect;
  location: typeof inventoryLocation.$inferSelect;
  rows: {
    item: typeof goodsReceiptItem.$inferSelect;
    material: typeof materialMaster.$inferSelect;
    inventory: typeof materialInventory.$inferSelect;
    before: { current: number; averageCost: number };
    after: { current: number; averageCost: number };
  }[];
}> {
  if (!actorCan(actor, receiptReversalPermission(input.action)))
    throw new ReceiptReversalError("FORBIDDEN", "Izin pembatalan penerimaan tidak tersedia.");
  if (
    input.action !== "RECEIPT_REVERSAL_APPROVE" &&
    (!input.reason || input.reason.trim().length < 10)
  )
    throw new ReceiptReversalError("VALIDATION_ERROR", "Alasan minimal 10 karakter wajib diisi.");
  const [receipt] = await tx
    .select()
    .from(goodsReceipt)
    .where(
      and(eq(goodsReceipt.id, input.goodsReceiptId), eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID)),
    )
    .for("update");
  if (!receipt) throw new ReceiptReversalError("NOT_FOUND", "Penerimaan tidak tersedia.");
  const proj = await assertReceiptScope(tx, actor, receipt.projectId);
  const required = input.action === "RECEIPT_REVERSAL_REQUEST" ? "POSTED" : "REVERSAL_REQUESTED";
  if (receipt.status !== required)
    throw new ReceiptReversalError(
      "CONFLICT",
      "Status penerimaan berubah. Periksa penerimaan dan minta preview terbaru.",
    );
  if (
    input.action === "RECEIPT_REVERSAL_APPROVE" &&
    receipt.reversalRequestedById === actor.userId &&
    !(actorCan(actor, "override:self_approval") && input.emergencyOverride && input.reason?.trim())
  )
    throw new ReceiptReversalError(
      "FORBIDDEN",
      "Pembatalan penerimaan harus disetujui pengguna lain. Emergency override hanya tersedia pada form manual.",
    );
  const location = await tx.query.inventoryLocation.findFirst({
    where: and(
      eq(inventoryLocation.id, receipt.inventoryLocationId),
      eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!location) throw new ReceiptReversalError("NOT_FOUND", "Lokasi penerimaan tidak tersedia.");
  const items = await tx.query.goodsReceiptItem.findMany({
    where: eq(goodsReceiptItem.goodsReceiptId, receipt.id),
    orderBy: [asc(goodsReceiptItem.materialId), asc(goodsReceiptItem.id)],
  });
  if (!items.length) throw new ReceiptReversalError("CONFLICT", "Item penerimaan tidak ditemukan.");
  const rows: Awaited<ReturnType<typeof prepareReceiptReversalTx>>["rows"] = [];
  const remaining = new Map<string, { current: number; averageCost: number }>();
  for (const item of items) {
    const [material] = await tx
      .select()
      .from(materialMaster)
      .where(
        and(
          eq(materialMaster.id, item.materialId),
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    const [inventory] = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.materialId, item.materialId),
          eq(materialInventory.locationId, receipt.inventoryLocationId),
          eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    if (!material || !inventory)
      throw new ReceiptReversalError(
        "NOT_FOUND",
        "Material atau inventory penerimaan tidak tersedia.",
      );
    let after = {
      current: Number(inventory.currentStock),
      averageCost: Number(inventory.averageCost),
    };
    const before = remaining.get(inventory.id) ?? after;
    if (input.action === "RECEIPT_REVERSAL_APPROVE") {
      if (item.reversalStockMovementId)
        throw new ReceiptReversalError("CONFLICT", "Item penerimaan sudah dibatalkan.");
      let valuation: ReturnType<typeof calculateReceiptReversalValuation>;
      try {
        valuation = calculateReceiptReversalValuation({
          currentQuantity: before.current,
          currentAverageCost: before.averageCost,
          receiptQuantity: Number(item.quantity),
          receiptUnitCost: Number(item.unitCost),
        });
      } catch {
        throw new ReceiptReversalError(
          "CONFLICT",
          "Stok atau nilai inventory tersisa tidak cukup untuk membatalkan penerimaan.",
        );
      }
      if (valuation.nextQuantity < Number(inventory.reservedStock))
        throw new ReceiptReversalError(
          "CONFLICT",
          "Pembatalan akan memakai stok yang sudah direservasi. Lepas reservasi terkait dahulu.",
        );
      after = {
        current: Number(valuation.nextQuantity.toFixed(2)),
        averageCost: Number(valuation.nextAverageCost.toFixed(2)),
      };
      remaining.set(inventory.id, after);
    }
    rows.push({ item, material, inventory, before, after });
  }
  if (input.action === "RECEIPT_REVERSAL_APPROVE") await assertOperationalStockReadiness(tx);
  return { receipt, project: proj, location, rows };
}
export async function writeReceiptReversalTx(
  tx: ReceiptReversalTx,
  actor: Actor,
  input: ReceiptReversalInput,
): Promise<typeof goodsReceipt.$inferSelect> {
  const { receipt, rows } = await prepareReceiptReversalTx(tx, actor, input);
  const selfApproval = receipt.reversalRequestedById === actor.userId;
  if (input.action === "RECEIPT_REVERSAL_APPROVE") {
    for (const { item, inventory, after } of rows) {
      await tx
        .update(materialInventory)
        .set({
          currentStock: after.current.toFixed(2),
          averageCost: after.averageCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(materialInventory.id, inventory.id));
      const [movement] = await tx
        .insert(stockMovement)
        .values({
          materialId: item.materialId,
          inventoryLocationId: receipt.inventoryLocationId,
          projectId: receipt.projectId,
          projectRapItemId: item.projectRapItemId,
          vendorBillId: receipt.vendorBillId,
          movementType: "GOODS_RECEIPT_REVERSAL",
          movementDirection: "OUT",
          referenceType: "GOODS_RECEIPT",
          referenceId: receipt.id,
          quantity: item.quantity,
          unitCost: item.unitCost,
          note: receipt.reversalReason ?? "Pembatalan penerimaan",
          createdById: actor.userId,
        })
        .returning();
      await tx
        .update(goodsReceiptItem)
        .set({ reversalStockMovementId: movement.id })
        .where(eq(goodsReceiptItem.id, item.id));
    }
  }
  const now = new Date();
  const change =
    input.action === "RECEIPT_REVERSAL_REQUEST"
      ? {
          status: "REVERSAL_REQUESTED",
          reversalReason: input.reason,
          reversalRequestedById: actor.userId,
          reversalRequestedAt: now,
        }
      : input.action === "RECEIPT_REVERSAL_APPROVE"
        ? { status: "REVERSED", reversedById: actor.userId, reversedAt: now }
        : {
            status: "POSTED",
            reversalReason: null,
            reversalRequestedById: null,
            reversalRequestedAt: null,
          };
  const [updated] = await tx
    .update(goodsReceipt)
    .set({ ...change, updatedAt: now })
    .where(and(eq(goodsReceipt.id, receipt.id), eq(goodsReceipt.status, receipt.status)))
    .returning();
  if (!updated) throw new ReceiptReversalError("CONFLICT", "Status penerimaan telah berubah.");
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action:
      input.action === "RECEIPT_REVERSAL_REQUEST"
        ? "REQUEST_GOODS_RECEIPT_REVERSAL"
        : input.action === "RECEIPT_REVERSAL_REJECT"
          ? "REJECT_GOODS_RECEIPT_REVERSAL"
          : selfApproval
            ? "EMERGENCY_SELF_APPROVE_GOODS_RECEIPT_REVERSAL"
            : "APPROVE_GOODS_RECEIPT_REVERSAL",
    targetTable: "goods_receipt",
    targetId: receipt.id,
    originalState: JSON.stringify({ ...receipt, items: rows.map((r) => r.item) }),
    newState: JSON.stringify({
      ...updated,
      rejectionReason: input.action === "RECEIPT_REVERSAL_REJECT" ? input.reason : null,
      emergencyReason:
        selfApproval && input.action === "RECEIPT_REVERSAL_APPROVE" ? input.reason : null,
    }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "goods_receipt",
    referenceId: updated.id,
    projectId: updated.projectId,
    stage: `${updated.status}:${updated.updatedAt.toISOString()}`,
    title:
      input.action === "RECEIPT_REVERSAL_REQUEST"
        ? "Pembatalan penerimaan menunggu persetujuan"
        : input.action === "RECEIPT_REVERSAL_APPROVE"
          ? "Penerimaan material dibatalkan"
          : "Pembatalan penerimaan ditolak",
    message: "Periksa penerimaan material terkait.",
    permission:
      input.action === "RECEIPT_REVERSAL_REQUEST"
        ? "approve:goods_receipt_reversal"
        : "view:material",
    actionRequired: input.action === "RECEIPT_REVERSAL_REQUEST",
    actionUrl: "/materials",
    actorId: actor.userId,
  });
  return updated;
}
