"use server";

import { and, asc, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  auditLog,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  materialInventory,
  stockMovement,
} from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { getOpeningInventoryIneligibleReason } from "@/lib/material/opening-inventory-eligibility";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  createInventoryOpeningSchema,
  decideInventoryOpeningSchema,
  previewInitialStockImportSchema,
  reverseInventoryOpeningSchema,
  type CreateInventoryOpeningInput,
  type DecideInventoryOpeningInput,
  type ReverseInventoryOpeningInput,
} from "@/lib/validations/material";
import { getSessionUser } from "./inventory-utils";
import { getMaterialInventory, type MaterialInventoryRow } from "./inventory";

type OpeningBatch = typeof inventoryOpeningBatch.$inferSelect;
export type InventoryOpeningBatchView = OpeningBatch & {
  readonly itemCount: number;
  readonly totalValue: number;
  readonly canReverse: boolean;
  readonly requestedByName: string;
  readonly approvedByName: string | null;
  readonly reversedByName: string | null;
  readonly items: readonly {
    readonly id: string;
    readonly materialInventoryId: string;
    readonly materialName: string;
    readonly locationName: string;
    readonly unit: string;
    readonly quantity: number;
    readonly unitCost: number;
    readonly totalValue: number;
    readonly currentStock: number;
    readonly reservedStock: number;
    readonly availableStock: number;
    readonly averageCost: number;
    readonly stockMovementId: string | null;
  }[];
};
export type InitialStockCandidate = MaterialInventoryRow & {
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
};
export type InitialStockImportPreview = {
  readonly items: readonly {
    readonly rowNumber: number;
    readonly materialInventoryId: string;
    readonly materialName: string;
    readonly locationName: string;
    readonly quantity: number;
    readonly unitCost: number;
  }[];
  readonly errors: readonly {
    readonly rowNumber: number;
    readonly message: string;
  }[];
};

function refresh(includeOwnerOnboarding = true): void {
  revalidatePath("/materials");
  revalidatePath("/settings");
  revalidatePath("/approvals");
  if (includeOwnerOnboarding) revalidatePath("/onboarding");
  revalidatePath("/onboarding/review");
}

function failure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message === "OPENING_NOT_FOUND")
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Batch saldo awal stok tidak ditemukan.",
      },
    };
  if (message === "MAKER_CHECKER_REQUIRED")
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message:
          "Pembuat pengajuan tidak boleh menyetujui sendiri. Gunakan Finance Admin sebagai pemeriksa terpisah.",
      },
    };
  if (message === "INVENTORY_ALREADY_ACTIVE")
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message:
          "Saldo awal hanya dapat diposting sebelum inventory memiliki saldo atau pergerakan stok.",
      },
    };
  if (message === "OPENING_ALREADY_PENDING")
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Inventory sudah ada dalam pengajuan saldo awal yang menunggu persetujuan.",
      },
    };
  if (message === "REVERSAL_HAS_LATER_MOVEMENT")
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Saldo awal tidak dapat dibalik setelah ada pergerakan stok berikutnya.",
      },
    };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

export async function createInventoryOpening(
  input: CreateInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = createInventoryOpeningSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Saldo awal stok tidak valid.",
      },
    };
  const session = await getSessionUser();
  if (!session.success) return session;
  try {
    await assertPermission(session.data.user, "create:opening_inventory");
    const created = await db.transaction(async (tx) => {
      const batchNumber =
        validation.data.batchNumber?.trim() ||
        `SA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const duplicate = await tx.query.inventoryOpeningBatch.findFirst({
        where: eq(inventoryOpeningBatch.batchNumber, batchNumber),
      });
      if (duplicate) throw new Error("Referensi saldo awal sudah digunakan. Coba ajukan kembali.");

      const inventoryIds = validation.data.items.map((item) => item.materialInventoryId).toSorted();
      for (const inventoryId of inventoryIds) {
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(eq(materialInventory.id, inventoryId))
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
          .innerJoin(
            inventoryOpeningBatch,
            eq(inventoryOpeningBatch.id, inventoryOpeningItem.batchId),
          )
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
          cutoverDate: validation.data.cutoverDate,
          status: "PENDING_APPROVAL",
          note: validation.data.note,
          referenceNumber: validation.data.referenceNumber?.trim() || null,
          requestedById: session.data.user.id,
        })
        .returning();
      await tx.insert(inventoryOpeningItem).values(
        validation.data.items.map((item) => ({
          batchId: batch.id,
          materialInventoryId: item.materialInventoryId,
          quantity: item.quantity.toFixed(2),
          unitCost: item.unitCost.toFixed(2),
        })),
      );
      await tx.insert(auditLog).values({
        userId: session.data.user.id,
        action: "REQUEST_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: batch.id,
        newState: JSON.stringify({ ...batch, items: validation.data.items }),
      });
      return batch;
    });
    refresh();
    return { success: true, data: created };
  } catch (error) {
    return failure(error, "Gagal mengajukan saldo awal stok.");
  }
}

export async function decideInventoryOpening(
  input: DecideInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = decideInventoryOpeningSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Keputusan tidak valid.",
      },
    };
  const session = await getSessionUser();
  if (!session.success) return session;
  try {
    await assertPermission(session.data.user, "approve:opening_inventory");
    const decided = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(inventoryOpeningBatch)
        .where(eq(inventoryOpeningBatch.id, validation.data.batchId))
        .for("update");
      if (!locked) throw new Error("OPENING_NOT_FOUND");
      if (locked.status !== "PENDING_APPROVAL")
        throw new Error("Batch saldo awal sudah diputuskan.");
      if (validation.data.decision === "REJECT") {
        const [rejected] = await tx
          .update(inventoryOpeningBatch)
          .set({
            status: "REJECTED",
            decisionReason: validation.data.reason,
            rejectedReason: validation.data.reason,
            approvedById: session.data.user.id,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(inventoryOpeningBatch.id, locked.id))
          .returning();
        await tx.insert(auditLog).values({
          userId: session.data.user.id,
          action: "REJECT_INVENTORY_OPENING",
          targetTable: "inventory_opening_batch",
          targetId: locked.id,
          originalState: JSON.stringify(locked),
          newState: JSON.stringify(rejected),
        });
        return rejected;
      }
      const selfApproval = locked.requestedById === session.data.user.id;
      if (selfApproval) throw new Error("MAKER_CHECKER_REQUIRED");
      const items = await tx.query.inventoryOpeningItem.findMany({
        where: eq(inventoryOpeningItem.batchId, locked.id),
        orderBy: [asc(inventoryOpeningItem.createdAt)],
      });
      for (const item of items) {
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(eq(materialInventory.id, item.materialInventoryId))
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
        )
          throw new Error("INVENTORY_ALREADY_ACTIVE");
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
            createdById: session.data.user.id,
          })
          .returning();
        await tx
          .update(inventoryOpeningItem)
          .set({ stockMovementId: movement.id })
          .where(eq(inventoryOpeningItem.id, item.id));
        await tx.insert(auditLog).values({
          userId: session.data.user.id,
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
          decisionReason: validation.data.reason,
          approvedById: session.data.user.id,
          approvedAt: new Date(),
          postedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventoryOpeningBatch.id, locked.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: session.data.user.id,
        action: "APPROVE_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: locked.id,
        originalState: JSON.stringify(locked),
        newState: JSON.stringify({
          ...posted,
          decisionReason: validation.data.reason,
        }),
      });
      return posted;
    });
    refresh(false);
    return { success: true, data: decided };
  } catch (error) {
    return failure(error, "Gagal memutus saldo awal stok.");
  }
}

export async function reverseInventoryOpening(
  input: ReverseInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = reverseInventoryOpeningSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Reversal tidak valid.",
      },
    };
  const session = await getSessionUser();
  if (!session.success) return session;
  try {
    await assertPermission(session.data.user, "reverse:opening_inventory");
    const reversed = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(inventoryOpeningBatch)
        .where(eq(inventoryOpeningBatch.id, validation.data.batchId))
        .for("update");
      if (!locked) throw new Error("OPENING_NOT_FOUND");
      if (locked.status !== "POSTED")
        throw new Error("Hanya saldo awal berstatus sudah diposting yang dapat dibalik.");
      const items = await tx.query.inventoryOpeningItem.findMany({
        where: eq(inventoryOpeningItem.batchId, locked.id),
        with: { stockMovement: true },
      });
      for (const item of items) {
        if (!item.stockMovement) throw new Error("Pergerakan saldo awal tidak ditemukan.");
        const later = await tx.query.stockMovement.findFirst({
          where: and(
            eq(stockMovement.materialId, item.stockMovement.materialId),
            eq(stockMovement.inventoryLocationId, item.stockMovement.inventoryLocationId),
            gt(stockMovement.createdAt, item.stockMovement.createdAt),
          ),
        });
        if (later) throw new Error("REVERSAL_HAS_LATER_MOVEMENT");
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(eq(materialInventory.id, item.materialInventoryId))
          .for("update");
        if (
          !inventory ||
          Number(inventory.currentStock) !== Number(item.quantity) ||
          Number(inventory.reservedStock) !== 0
        )
          throw new Error("Saldo inventory sudah berubah dan tidak aman untuk reversal.");
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
            note: validation.data.reason,
            createdById: session.data.user.id,
          })
          .returning();
        await tx
          .update(inventoryOpeningItem)
          .set({ reversalStockMovementId: movement.id })
          .where(eq(inventoryOpeningItem.id, item.id));
        await tx.insert(auditLog).values({
          userId: session.data.user.id,
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
          reversedById: session.data.user.id,
          reversedAt: new Date(),
          reversalReason: validation.data.reason,
          updatedAt: new Date(),
        })
        .where(eq(inventoryOpeningBatch.id, locked.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: session.data.user.id,
        action: "REVERSE_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: locked.id,
        originalState: JSON.stringify(locked),
        newState: JSON.stringify(updated),
      });
      return updated;
    });
    refresh();
    return { success: true, data: reversed };
  } catch (error) {
    return failure(error, "Gagal membalik saldo awal stok.");
  }
}

export async function getInitialStockCandidates(): Promise<
  ActionResponse<readonly InitialStockCandidate[]>
> {
  const inventory = await getMaterialInventory();
  if (!inventory.success) return inventory;
  const [movements, pendingBatches] = await Promise.all([
    db.query.stockMovement.findMany({
      columns: { materialId: true, inventoryLocationId: true },
    }),
    db.query.inventoryOpeningBatch.findMany({
      where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
      columns: { id: true },
      with: {
        items: { columns: { materialInventoryId: true } },
      },
    }),
  ]);
  const moved = new Set(movements.map((row) => `${row.materialId}:${row.inventoryLocationId}`));
  const pendingInventoryIds = new Set(
    pendingBatches.flatMap((batch) => batch.items.map((item) => item.materialInventoryId)),
  );
  return {
    success: true,
    data: inventory.data.map((row) => {
      const hasMovement = moved.has(`${row.materialId}:${row.locationId}`);
      const ineligibleReason = getOpeningInventoryIneligibleReason({
        hasPendingOpening: pendingInventoryIds.has(row.inventoryId),
        currentStock: row.currentStock,
        reservedStock: row.reservedStock,
        hasMovement,
      });
      return { ...row, eligible: ineligibleReason === null, ineligibleReason };
    }),
  };
}

export async function previewInitialStockImport(
  input: unknown,
): Promise<ActionResponse<InitialStockImportPreview>> {
  const validation = previewInitialStockImportSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "CSV saldo awal tidak valid.",
      },
    };
  const session = await getSessionUser();
  if (!session.success) return session;
  await assertPermission(session.data.user, "create:opening_inventory");
  const candidates = await getInitialStockCandidates();
  if (!candidates.success) return candidates;
  const eligible = candidates.data.filter((row) => row.eligible);
  const items: InitialStockImportPreview["items"][number][] = [];
  const errors: InitialStockImportPreview["errors"][number][] = [];
  const selectedIds = new Set<string>();

  for (const row of validation.data.rows) {
    const rowErrors: string[] = [];
    if (!row.locationName) rowErrors.push("Lokasi wajib diisi.");
    if (!row.materialCode && !row.materialName)
      rowErrors.push("Isi material_code atau material_name.");
    if (!Number.isFinite(row.quantity) || row.quantity <= 0)
      rowErrors.push("Jumlah fisik harus lebih besar dari 0.");
    if (!Number.isFinite(row.unitCost) || row.unitCost <= 0)
      rowErrors.push("Harga pokok harus lebih besar dari 0.");
    if (rowErrors.length > 0) {
      errors.push({ rowNumber: row.rowNumber, message: rowErrors.join(" ") });
      continue;
    }
    const code = row.materialCode.toLocaleLowerCase("id-ID");
    const name = row.materialName.toLocaleLowerCase("id-ID");
    const location = row.locationName.toLocaleLowerCase("id-ID");
    const matches = eligible.filter((candidate) => {
      const sameLocation = candidate.locationName.toLocaleLowerCase("id-ID") === location;
      if (!sameLocation) return false;
      if (code) return candidate.code?.toLocaleLowerCase("id-ID") === code;
      return Boolean(name) && candidate.materialName.toLocaleLowerCase("id-ID") === name;
    });
    if (matches.length !== 1) {
      errors.push({
        rowNumber: row.rowNumber,
        message:
          matches.length === 0
            ? "Material/lokasi tidak ditemukan atau sudah tidak eligible."
            : "Material/lokasi ambigu. Isi code material yang unik.",
      });
      continue;
    }
    const match = matches[0];
    if (selectedIds.has(match.inventoryId)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: "Material dan lokasi muncul lebih dari sekali.",
      });
      continue;
    }
    selectedIds.add(match.inventoryId);
    items.push({
      rowNumber: row.rowNumber,
      materialInventoryId: match.inventoryId,
      materialName: match.materialName,
      locationName: match.locationName,
      quantity: row.quantity,
      unitCost: row.unitCost,
    });
  }
  return { success: true, data: { items, errors } };
}

export async function getInventoryOpeningBatches(): Promise<
  ActionResponse<readonly InventoryOpeningBatchView[]>
> {
  const session = await getSessionUser();
  if (!session.success) return session;
  await assertPermission(session.data.user, "view:inventory");
  const roleName = await resolveRoleName(session.data.user.roleId);
  const rows = await db.query.inventoryOpeningBatch.findMany({
    with: {
      requestedBy: { columns: { name: true } },
      approvedBy: { columns: { name: true } },
      reversedBy: { columns: { name: true } },
      items: {
        with: {
          inventory: {
            columns: {
              id: true,
              currentStock: true,
              reservedStock: true,
              averageCost: true,
            },
            with: {
              material: { columns: { name: true, unit: true } },
              location: { columns: { name: true } },
            },
          },
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  return {
    success: true,
    data: rows.map((row) => {
      const { requestedBy, approvedBy, reversedBy, items: openingItems, ...batch } = row;
      const items = openingItems.map((item) => {
        const quantity = Number(item.quantity);
        const unitCost = Number(item.unitCost);
        return {
          id: item.id,
          materialInventoryId: item.materialInventoryId,
          materialName: item.inventory.material.name,
          locationName: item.inventory.location.name,
          unit: item.inventory.material.unit,
          quantity,
          unitCost,
          totalValue: quantity * unitCost,
          currentStock: Number(item.inventory.currentStock),
          reservedStock: Number(item.inventory.reservedStock),
          availableStock:
            Number(item.inventory.currentStock) - Number(item.inventory.reservedStock),
          averageCost: Number(item.inventory.averageCost),
          stockMovementId: item.stockMovementId,
        };
      });
      return {
        ...batch,
        requestedByName: requestedBy.name,
        approvedByName: approvedBy?.name ?? null,
        reversedByName: reversedBy?.name ?? null,
        itemCount: items.length,
        totalValue: items.reduce((sum, item) => sum + item.totalValue, 0),
        canReverse: roleName === "OWNER" && row.status === "POSTED",
        items,
      };
    }),
  };
}
