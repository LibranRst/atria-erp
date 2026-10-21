import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  goodsReceipt,
  goodsReceiptItem,
  inventoryLocation,
  materialMaster,
  project,
  stockCount,
  stockCountItem,
  stockMovement,
  stockTransfer,
  stockTransferItem,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  materialDesktopActivityInputSchema,
  type MaterialDesktopActivityData,
  type MaterialDesktopActivityInput,
  type MaterialDesktopActivityRequest,
} from "@atria/core/material/material-desktop";
import { materialProjectReferenceScope } from "./material-read-scope";

function dateFilter(
  column: AnyColumn,
  input: MaterialDesktopActivityInput,
  now: Date,
): SQL | undefined {
  return input.period === "all"
    ? undefined
    : gte(column, new Date(now.getTime() - Number(input.period) * 86_400_000));
}
function order(input: MaterialDesktopActivityInput, column: AnyColumn | SQL): SQL {
  return input.direction === "ascending" ? asc(column) : desc(column);
}
function pageFor(total: number, input: MaterialDesktopActivityInput): number {
  return Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
}
function searchFilter(
  input: MaterialDesktopActivityInput,
  columns: readonly AnyColumn[],
): SQL | undefined {
  // Search text is literal; percent and underscore do not become wildcard filters.
  const term = input.search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return term ? or(...columns.map((column) => ilike(column, `%${term}%`))) : undefined;
}

async function movements(
  actor: Actor,
  input: MaterialDesktopActivityInput,
  updatedAt: Date,
): Promise<MaterialDesktopActivityData> {
  const where = and(
    eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
    eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
    eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
    materialProjectReferenceScope(stockMovement.projectId, actor, true),
    input.projectId ? eq(stockMovement.projectId, input.projectId) : undefined,
    input.locationId ? eq(stockMovement.inventoryLocationId, input.locationId) : undefined,
    input.status !== "all" ? eq(stockMovement.movementType, input.status) : undefined,
    dateFilter(stockMovement.createdAt, input, updatedAt),
    searchFilter(input, [
      materialMaster.name,
      inventoryLocation.name,
      project.name,
      stockMovement.note,
    ]),
  );
  const query = db
    .select({ id: stockMovement.id })
    .from(stockMovement)
    .innerJoin(materialMaster, eq(materialMaster.id, stockMovement.materialId))
    .innerJoin(inventoryLocation, eq(inventoryLocation.id, stockMovement.inventoryLocationId))
    .leftJoin(project, eq(project.id, stockMovement.projectId));
  const [totalRow] = await db
    .select({ total: count() })
    .from(stockMovement)
    .innerJoin(materialMaster, eq(materialMaster.id, stockMovement.materialId))
    .innerJoin(inventoryLocation, eq(inventoryLocation.id, stockMovement.inventoryLocationId))
    .leftJoin(project, eq(project.id, stockMovement.projectId))
    .where(where);
  const total = totalRow?.total ?? 0,
    page = pageFor(total, input);
  const sort =
    input.sort === "name"
      ? materialMaster.name
      : input.sort === "quantity"
        ? stockMovement.quantity
        : input.sort === "value"
          ? sql`${stockMovement.quantity} * ${stockMovement.unitCost}`
          : input.sort === "status"
            ? stockMovement.movementType
            : stockMovement.createdAt;
  const ids = await query
    .where(where)
    .orderBy(order(input, sort), asc(stockMovement.id))
    .limit(input.pageSize)
    .offset((page - 1) * input.pageSize);
  const source = ids.length
    ? await db.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
          inArray(
            stockMovement.id,
            ids.map((r) => r.id),
          ),
        ),
        with: { material: true, location: true, project: true, createdBy: true },
      })
    : [];
  const byId = new Map(source.map((row) => [row.id, row]));
  return {
    kind: "movements",
    total,
    page,
    pageSize: input.pageSize,
    updatedAt,
    rows: ids.flatMap(({ id }) => {
      const row = byId.get(id);
      if (!row) return [];
      const inferredDirection = ["STOCK_IN", "GOODS_RECEIPT", "RETURN", "TRANSFER_IN"].includes(
        row.movementType,
      )
        ? "IN"
        : ["USE", "WASTE", "TRANSFER_OUT", "GOODS_RECEIPT_REVERSAL"].includes(row.movementType)
          ? "OUT"
          : "NEUTRAL";
      return [
        {
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
        },
      ];
    }),
  };
}

async function receipts(
  actor: Actor,
  input: MaterialDesktopActivityInput,
  updatedAt: Date,
): Promise<MaterialDesktopActivityData> {
  const totals = db
    .select({
      id: goodsReceiptItem.goodsReceiptId,
      value: sql<string>`sum(${goodsReceiptItem.quantity} * ${goodsReceiptItem.unitCost})`.as(
        "value",
      ),
      items: count().as("items"),
    })
    .from(goodsReceiptItem)
    .where(eq(goodsReceiptItem.tenantId, INSTANCE_TENANT_ID))
    .groupBy(goodsReceiptItem.goodsReceiptId)
    .as("receipt_totals");
  const where = and(
    eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID),
    eq(project.tenantId, INSTANCE_TENANT_ID),
    eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
    materialProjectReferenceScope(goodsReceipt.projectId, actor),
    input.projectId ? eq(goodsReceipt.projectId, input.projectId) : undefined,
    input.locationId ? eq(goodsReceipt.inventoryLocationId, input.locationId) : undefined,
    input.status !== "all" ? eq(goodsReceipt.status, input.status) : undefined,
    dateFilter(goodsReceipt.receivedAt, input, updatedAt),
    searchFilter(input, [goodsReceipt.receiptNumber, project.name, inventoryLocation.name]),
  );
  const [totalRow] = await db
    .select({ total: count() })
    .from(goodsReceipt)
    .innerJoin(project, eq(project.id, goodsReceipt.projectId))
    .innerJoin(inventoryLocation, eq(inventoryLocation.id, goodsReceipt.inventoryLocationId))
    .where(where);
  const total = totalRow?.total ?? 0,
    page = pageFor(total, input);
  const sort =
    input.sort === "name"
      ? goodsReceipt.receiptNumber
      : input.sort === "value"
        ? sql`coalesce(${totals.value}, 0)`
        : input.sort === "quantity"
          ? sql`coalesce(${totals.items}, 0)`
          : input.sort === "status"
            ? goodsReceipt.status
            : goodsReceipt.receivedAt;
  const ids = await db
    .select({ id: goodsReceipt.id })
    .from(goodsReceipt)
    .innerJoin(project, eq(project.id, goodsReceipt.projectId))
    .innerJoin(inventoryLocation, eq(inventoryLocation.id, goodsReceipt.inventoryLocationId))
    .leftJoin(totals, eq(totals.id, goodsReceipt.id))
    .where(where)
    .orderBy(order(input, sort), asc(goodsReceipt.id))
    .limit(input.pageSize)
    .offset((page - 1) * input.pageSize);
  const source = ids.length
    ? await db.query.goodsReceipt.findMany({
        where: and(
          eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID),
          inArray(
            goodsReceipt.id,
            ids.map((r) => r.id),
          ),
        ),
        with: {
          project: true,
          inventoryLocation: true,
          vendorBill: true,
          receivedBy: true,
          items: {
            where: eq(goodsReceiptItem.tenantId, INSTANCE_TENANT_ID),
            with: { material: true },
          },
        },
      })
    : [];
  const byId = new Map(source.map((row) => [row.id, row]));
  return {
    kind: "receipts",
    total,
    page,
    pageSize: input.pageSize,
    updatedAt,
    rows: ids.flatMap(({ id }) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        {
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
            unit: item.material.unit,
          })),
        },
      ];
    }),
  };
}

async function transfers(
  input: MaterialDesktopActivityInput,
  updatedAt: Date,
): Promise<MaterialDesktopActivityData> {
  const fromLocation = alias(inventoryLocation, "from_location"),
    toLocation = alias(inventoryLocation, "to_location");
  const totals = db
    .select({
      id: stockTransferItem.stockTransferId,
      items: count().as("items"),
      value: sql<string>`sum(${stockTransferItem.quantity} * ${stockTransferItem.unitCost})`.as(
        "value",
      ),
    })
    .from(stockTransferItem)
    .where(eq(stockTransferItem.tenantId, INSTANCE_TENANT_ID))
    .groupBy(stockTransferItem.stockTransferId)
    .as("transfer_totals");
  const where = and(
    eq(stockTransfer.tenantId, INSTANCE_TENANT_ID),
    eq(fromLocation.tenantId, INSTANCE_TENANT_ID),
    eq(toLocation.tenantId, INSTANCE_TENANT_ID),
    input.locationId
      ? or(
          eq(stockTransfer.fromLocationId, input.locationId),
          eq(stockTransfer.toLocationId, input.locationId),
        )
      : undefined,
    input.projectId || input.status !== "all"
      ? eq(stockTransfer.id, "00000000-0000-0000-0000-000000000000")
      : undefined,
    dateFilter(stockTransfer.transferredAt, input, updatedAt),
    searchFilter(input, [
      stockTransfer.transferNumber,
      stockTransfer.note,
      fromLocation.name,
      toLocation.name,
    ]),
  );
  const [totalRow] = await db
    .select({ total: count() })
    .from(stockTransfer)
    .innerJoin(fromLocation, eq(fromLocation.id, stockTransfer.fromLocationId))
    .innerJoin(toLocation, eq(toLocation.id, stockTransfer.toLocationId))
    .where(where);
  const total = totalRow?.total ?? 0,
    page = pageFor(total, input);
  const sort =
    input.sort === "name"
      ? stockTransfer.transferNumber
      : input.sort === "quantity"
        ? sql`coalesce(${totals.items}, 0)`
        : input.sort === "value"
          ? sql`coalesce(${totals.value}, 0)`
          : stockTransfer.transferredAt;
  const ids = await db
    .select({ id: stockTransfer.id })
    .from(stockTransfer)
    .innerJoin(fromLocation, eq(fromLocation.id, stockTransfer.fromLocationId))
    .innerJoin(toLocation, eq(toLocation.id, stockTransfer.toLocationId))
    .leftJoin(totals, eq(totals.id, stockTransfer.id))
    .where(where)
    .orderBy(order(input, sort), asc(stockTransfer.id))
    .limit(input.pageSize)
    .offset((page - 1) * input.pageSize);
  const source = ids.length
    ? await db.query.stockTransfer.findMany({
        where: and(
          eq(stockTransfer.tenantId, INSTANCE_TENANT_ID),
          inArray(
            stockTransfer.id,
            ids.map((r) => r.id),
          ),
        ),
        with: {
          fromLocation: true,
          toLocation: true,
          items: {
            where: eq(stockTransferItem.tenantId, INSTANCE_TENANT_ID),
            with: { material: true },
          },
        },
      })
    : [];
  const byId = new Map(source.map((row) => [row.id, row]));
  return {
    kind: "transfers",
    total,
    page,
    pageSize: input.pageSize,
    updatedAt,
    rows: ids.flatMap(({ id }) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        {
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
            unit: item.material.unit,
          })),
        },
      ];
    }),
  };
}

async function counts(
  actor: Actor,
  input: MaterialDesktopActivityInput,
  updatedAt: Date,
): Promise<MaterialDesktopActivityData> {
  const totals = db
    .select({ id: stockCountItem.stockCountId, items: count().as("items") })
    .from(stockCountItem)
    .where(eq(stockCountItem.tenantId, INSTANCE_TENANT_ID))
    .groupBy(stockCountItem.stockCountId)
    .as("count_totals");
  const where = and(
    eq(stockCount.tenantId, INSTANCE_TENANT_ID),
    eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
    input.locationId ? eq(stockCount.inventoryLocationId, input.locationId) : undefined,
    input.projectId ? eq(stockCount.id, "00000000-0000-0000-0000-000000000000") : undefined,
    input.status !== "all" ? eq(stockCount.status, input.status) : undefined,
    dateFilter(stockCount.countedAt, input, updatedAt),
    searchFilter(input, [stockCount.countNumber, stockCount.note, inventoryLocation.name]),
  );
  const [totalRow] = await db
    .select({ total: count() })
    .from(stockCount)
    .innerJoin(inventoryLocation, eq(inventoryLocation.id, stockCount.inventoryLocationId))
    .where(where);
  const total = totalRow?.total ?? 0,
    page = pageFor(total, input);
  const sort =
    input.sort === "name"
      ? stockCount.countNumber
      : input.sort === "quantity"
        ? sql`coalesce(${totals.items}, 0)`
        : input.sort === "status"
          ? stockCount.status
          : stockCount.countedAt;
  const ids = await db
    .select({ id: stockCount.id })
    .from(stockCount)
    .innerJoin(inventoryLocation, eq(inventoryLocation.id, stockCount.inventoryLocationId))
    .leftJoin(totals, eq(totals.id, stockCount.id))
    .where(where)
    .orderBy(order(input, sort), asc(stockCount.id))
    .limit(input.pageSize)
    .offset((page - 1) * input.pageSize);
  const source = ids.length
    ? await db.query.stockCount.findMany({
        where: and(
          eq(stockCount.tenantId, INSTANCE_TENANT_ID),
          inArray(
            stockCount.id,
            ids.map((r) => r.id),
          ),
        ),
        with: {
          location: true,
          createdBy: true,
          items: {
            where: eq(stockCountItem.tenantId, INSTANCE_TENANT_ID),
            with: { material: true },
          },
        },
      })
    : [];
  const byId = new Map(source.map((row) => [row.id, row]));
  return {
    kind: "counts",
    total,
    page,
    pageSize: input.pageSize,
    updatedAt,
    rows: ids.flatMap(({ id }) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        {
          id: row.id,
          countNumber: row.countNumber,
          status: row.status,
          canEdit: row.status === "DRAFT" && row.createdById === actor.userId,
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
            unit: item.material.unit,
          })),
        },
      ];
    }),
  };
}

export async function getMaterialDesktopActivityUseCase(
  actor: Actor,
  raw: MaterialDesktopActivityRequest,
): Promise<ActionResponse<MaterialDesktopActivityData>> {
  if (!actorCan(actor, "view:inventory"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses material tidak tersedia." },
    };
  const parsed = materialDesktopActivityInputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Filter aktivitas material tidak valid." },
    };
  const input = parsed.data,
    updatedAt = new Date();
  try {
    const data =
      input.kind === "movements"
        ? await movements(actor, input, updatedAt)
        : input.kind === "receipts"
          ? await receipts(actor, input, updatedAt)
          : input.kind === "transfers"
            ? await transfers(input, updatedAt)
            : await counts(actor, input, updatedAt);
    return { success: true, data };
  } catch {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Aktivitas material belum dapat dimuat. Coba lagi.",
      },
    };
  }
}
