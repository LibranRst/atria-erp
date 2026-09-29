"use server";

import { getRoleAccessByName } from "@/lib/auth/role-access";

import { cookies } from "next/headers";
import { and, desc, eq, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { goodsReceipt, project, stockMovement, vendorBill } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import { movementPageSchema } from "@atria/core/validations/warehouse";
import {
  getMaterialInventory,
  getMaterialShortages,
  type MaterialInventoryRow,
  type MaterialShortageRow,
} from "./inventory";
import type { GoodsReceiptVendorBillOption } from "@/features/materials/utils/goods-receipt-prefill";

export interface MaterialMovementView {
  readonly id: string;
  readonly movementType: string;
  readonly movementDirection: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly materialId: string;
  readonly materialName: string;
  readonly unit: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly createdByName: string;
}
export interface MaterialMovementPage {
  readonly items: MaterialMovementView[];
  readonly hasMore: boolean;
}
export interface ReceiptView {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly vendorBillNumber: string | null;
  readonly receivedAt: Date;
  readonly receivedByName: string;
  readonly reversalReason: string | null;
  readonly total: number;
  readonly items: readonly {
    readonly materialName: string;
    readonly quantity: number;
    readonly unitCost: number;
  }[];
}
export interface CountView {
  readonly id: string;
  readonly countNumber: string;
  readonly status: string;
  readonly canEdit: boolean;
  readonly locationId: string;
  readonly locationName: string;
  readonly countedAt: Date;
  readonly createdByName: string;
  readonly note: string | null;
  readonly items: readonly {
    readonly materialId: string;
    readonly materialName: string;
    readonly systemQuantity: number;
    readonly countedQuantity: number;
    readonly varianceQuantity: number;
  }[];
}
export interface TransferView {
  readonly id: string;
  readonly transferNumber: string;
  readonly fromLocationName: string;
  readonly toLocationName: string;
  readonly transferredAt: Date;
  readonly note: string;
  readonly items: readonly {
    readonly materialName: string;
    readonly quantity: number;
    readonly unitCost: number;
  }[];
}
export interface ProjectStockOption {
  readonly id: string;
  readonly name: string;
  readonly rapItems: readonly {
    readonly id: string;
    readonly materialId: string | null;
    readonly name: string;
    readonly area: string;
    readonly unit: string;
    readonly quantity?: number | null;
    readonly unitCost?: number | null;
  }[];
}
export interface MaterialOperationsDashboard {
  readonly roleName: string;
  readonly capabilities: {
    readonly canReceive: boolean;
    readonly canOperate: boolean;
    readonly canTransfer: boolean;
    readonly canCount: boolean;
    readonly canApproveCount: boolean;
    readonly canRequestReversal: boolean;
    readonly canApproveReversal: boolean;
    readonly canEmergencyAdjust: boolean;
  };
  readonly inventory: MaterialInventoryRow[];
  readonly shortages: MaterialShortageRow[];
  readonly movements: MaterialMovementView[];
  readonly movementsHasMore: boolean;
  readonly receipts: ReceiptView[];
  readonly counts: CountView[];
  readonly transfers: TransferView[];
  readonly projects: ProjectStockOption[];
  readonly bills: readonly GoodsReceiptVendorBillOption[];
}

type MaterialMovementCursor = {
  readonly createdAt: Date;
  readonly id: string;
};

async function movementRows(
  limit: number,
  cursor?: MaterialMovementCursor,
): Promise<MaterialMovementPage> {
  const rows = await db.query.stockMovement.findMany({
    where: cursor
      ? or(
          lt(stockMovement.createdAt, cursor.createdAt),
          and(eq(stockMovement.createdAt, cursor.createdAt), lt(stockMovement.id, cursor.id)),
        )
      : undefined,
    with: { material: true, location: true, project: true, createdBy: true },
    orderBy: [desc(stockMovement.createdAt), desc(stockMovement.id)],
    limit: limit + 1,
  });
  const items = rows.slice(0, limit).map((row) => {
    const inferredDirection = ["STOCK_IN", "GOODS_RECEIPT", "RETURN", "TRANSFER_IN"].includes(
      row.movementType,
    )
      ? "IN"
      : ["USE", "WASTE", "TRANSFER_OUT", "GOODS_RECEIPT_REVERSAL"].includes(row.movementType)
        ? "OUT"
        : "NEUTRAL";
    return {
      id: row.id,
      movementType: row.movementType,
      movementDirection:
        row.movementDirection === "NEUTRAL" ? inferredDirection : row.movementDirection,
      quantity: Number(row.quantity),
      unitCost: Number(row.unitCost),
      note: row.note,
      createdAt: row.createdAt,
      materialId: row.materialId,
      materialName: row.material.name,
      unit: row.material.unit,
      locationId: row.inventoryLocationId,
      locationName: row.location.name,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      createdByName: row.createdBy.name,
    };
  });
  return { items, hasMore: rows.length > limit };
}

export async function getMaterialMovementPage(
  input: unknown,
): Promise<ActionResponse<MaterialMovementPage>> {
  const parsed = movementPageSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Cursor activity tidak valid." },
    };
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(session.user, "view:inventory");
    return { success: true, data: await movementRows(parsed.data.limit, parsed.data.cursor) };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses ditolak.",
      },
    };
  }
}

export async function getMaterialOperationsDashboard(): Promise<
  ActionResponse<MaterialOperationsDashboard>
> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(session.user, "view:inventory");
    const roleName = await resolveRoleName(session.user.roleId);
    const [
      inventoryResult,
      shortageResult,
      movementPage,
      receipts,
      counts,
      transfers,
      projects,
      bills,
    ] = await Promise.all([
      getMaterialInventory(),
      getMaterialShortages(),
      movementRows(30),
      db.query.goodsReceipt.findMany({
        with: {
          project: true,
          inventoryLocation: true,
          vendorBill: true,
          receivedBy: true,
          items: { with: { material: true } },
        },
        orderBy: [desc(goodsReceipt.createdAt)],
        limit: 50,
      }),
      db.query.stockCount.findMany({
        with: {
          location: true,
          createdBy: true,
          approvedBy: true,
          items: { with: { material: true } },
        },
        orderBy: (table, { desc: descending }) => [descending(table.createdAt)],
        limit: 50,
      }),
      db.query.stockTransfer.findMany({
        with: { fromLocation: true, toLocation: true, items: { with: { material: true } } },
        orderBy: (table, { desc: descending }) => [descending(table.createdAt)],
        limit: 50,
      }),
      db.query.project.findMany({
        where: eq(project.status, "ACTIVE"),
        columns: { id: true, name: true },
        with: { raps: { with: { items: true } } },
        orderBy: (table, { asc }) => [asc(table.name)],
      }),
      db.query.vendorBill.findMany({
        where: ne(vendorBill.status, "VOID"),
        columns: {
          id: true,
          projectId: true,
          billNumber: true,
          amount: true,
          status: true,
          notes: true,
          materialId: true,
          projectRapItemId: true,
        },
        with: {
          vendor: { columns: { name: true } },
          project: { columns: { name: true } },
          rapItem: { columns: { materialId: true, totalQuantity: true, estimatedUnitCost: true } },
          goodsReceipts: { with: { items: true } },
          budgetCategory: { with: { expenseCategory: { columns: { code: true } } } },
        },
        orderBy: (table, { desc: descending }) => [descending(table.createdAt)],
      }),
    ]);
    if (!inventoryResult.success) return inventoryResult;
    const shortages = shortageResult.success ? shortageResult.data : [];
    const permissions = (await getRoleAccessByName(roleName))?.permissions ?? [];
    const operational = permissions.includes("create:stock_movement");
    const billOptions = bills
      .filter((row) => row.budgetCategory.expenseCategory.code === "MATERIAL")
      .map((row) => {
        const activeReceiptItems = row.goodsReceipts
          .filter((receipt) => receipt.status !== "REVERSED")
          .flatMap((receipt) => receipt.items);
        const matchingItems = activeReceiptItems.filter((item) =>
          row.projectRapItemId
            ? item.projectRapItemId === row.projectRapItemId
            : item.materialId === (row.materialId ?? row.rapItem?.materialId),
        );
        const receivedQuantity = matchingItems.reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        );
        const receivedAmount = activeReceiptItems.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
          0,
        );
        const rapItemQuantity = row.rapItem ? Number(row.rapItem.totalQuantity) : null;
        return {
          id: row.id,
          projectId: row.projectId,
          projectName: row.project.name,
          vendorName: row.vendor.name,
          name: row.billNumber,
          amount: Number(row.amount),
          status: row.status,
          notes: row.notes,
          materialId: row.materialId ?? row.rapItem?.materialId ?? null,
          projectRapItemId: row.projectRapItemId,
          rapItemQuantity,
          rapItemUnitCost: row.rapItem ? Number(row.rapItem.estimatedUnitCost) : null,
          receivedQuantity,
          receivedAmount,
          remainingQuantity:
            rapItemQuantity === null ? null : Math.max(0, rapItemQuantity - receivedQuantity),
          remainingAmount: Math.max(0, Number(row.amount) - receivedAmount),
        };
      })
      .filter(
        (row) =>
          row.remainingAmount > 0.01 &&
          (row.remainingQuantity === null || row.remainingQuantity > 0),
      );
    return {
      success: true,
      data: {
        roleName,
        capabilities: {
          canReceive: operational,
          canOperate: operational,
          canTransfer: permissions.includes("transfer:stock"),
          canCount: permissions.includes("create:stock_count"),
          canApproveCount: permissions.includes("approve:stock_count"),
          canRequestReversal: permissions.includes("request:goods_receipt_reversal"),
          canApproveReversal: permissions.includes("approve:goods_receipt_reversal"),
          canEmergencyAdjust: permissions.includes("adjust:stock"),
        },
        inventory: inventoryResult.data,
        shortages,
        movements: movementPage.items,
        movementsHasMore: movementPage.hasMore,
        receipts: receipts.map((row) => ({
          id: row.id,
          receiptNumber: row.receiptNumber,
          status: row.status,
          projectId: row.projectId,
          projectName: row.project.name,
          locationId: row.inventoryLocationId,
          locationName: row.inventoryLocation.name,
          vendorBillNumber: row.vendorBill?.billNumber ?? null,
          receivedAt: row.receivedAt,
          receivedByName: row.receivedBy.name,
          reversalReason: row.reversalReason,
          total: row.items.reduce(
            (sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
            0,
          ),
          items: row.items.map((item) => ({
            materialName: item.material.name,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
          })),
        })),
        counts: counts.map((row) => ({
          id: row.id,
          countNumber: row.countNumber,
          status: row.status,
          canEdit: row.status === "DRAFT" && row.createdById === session.user.id,
          locationId: row.inventoryLocationId,
          locationName: row.location.name,
          countedAt: row.countedAt,
          createdByName: row.createdBy.name,
          note: row.note,
          items: row.items.map((item) => ({
            materialId: item.materialId,
            materialName: item.material.name,
            systemQuantity: Number(item.systemQuantity),
            countedQuantity: Number(item.countedQuantity),
            varianceQuantity: Number(item.varianceQuantity),
          })),
        })),
        transfers: transfers.map((row) => ({
          id: row.id,
          transferNumber: row.transferNumber,
          fromLocationName: row.fromLocation.name,
          toLocationName: row.toLocation.name,
          transferredAt: row.transferredAt,
          note: row.note,
          items: row.items.map((item) => ({
            materialName: item.material.name,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
          })),
        })),
        projects: projects.map((row) => ({
          id: row.id,
          name: row.name,
          rapItems:
            row.raps
              .sort((a, b) => b.revision - a.revision)[0]
              ?.items.map((item) => ({
                id: item.id,
                materialId: item.materialId,
                name: item.name,
                area: item.area,
                unit: item.unit,
                quantity: Number(item.totalQuantity),
                unitCost: Number(item.estimatedUnitCost),
              })) ?? [],
        })),
        bills: billOptions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses material ditolak.",
      },
    };
  }
}
