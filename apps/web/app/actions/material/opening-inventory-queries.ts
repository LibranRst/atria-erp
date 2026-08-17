"use server";

import { eq } from "drizzle-orm";

import { getMaterialInventory } from "@/app/actions/material/inventory";
import { getSessionUser } from "@/app/actions/material/inventory-utils";
import type {
  InitialStockCandidate,
  InitialStockImportPreview,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory-types";
import { db } from "@/db";
import { inventoryOpeningBatch } from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { getOpeningInventoryIneligibleReason } from "@/lib/material/opening-inventory-eligibility";
import type { ActionResponse } from "@/lib/types/action-response";
import { previewInitialStockImportSchema } from "@/lib/validations/material";

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
      with: { items: { columns: { materialInventoryId: true } } },
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
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "CSV saldo awal tidak valid.",
      },
    };
  }
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
    if (!row.materialCode && !row.materialName) {
      rowErrors.push("Isi material_code atau material_name.");
    }
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      rowErrors.push("Jumlah fisik harus lebih besar dari 0.");
    }
    if (!Number.isFinite(row.unitCost) || row.unitCost <= 0) {
      rowErrors.push("Harga pokok harus lebih besar dari 0.");
    }
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
