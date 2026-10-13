import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  projectRap,
  projectRapItem,
  vendorBill,
  inventoryLocation,
  materialMaster,
  materialInventory,
  stockMovement,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  goodsReceipt,
  warehouseIntake,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import { WarehouseIntakeError } from "@backend/server/usecases/material/warehouse-intake-writer";
import { warehouseIntakeInputSchema } from "@atria/core/ai/procurement-warehouse";
import { getOpeningInventoryIneligibleReason } from "@atria/core/material/opening-inventory-eligibility";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { AiToolContext } from "./context";

async function current(): Promise<Actor> {
  const actor = await resolveActor();
  if (
    !actor ||
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, "view:material") ||
    !actorCan(actor, "view:inventory") ||
    ![
      "create:stock_movement",
      "create:opening_inventory",
      "approve:opening_inventory",
      "reverse:opening_inventory",
    ].some((p) => actor.permissions.some((grant) => grant === p))
  )
    throw new WarehouseIntakeError("FORBIDDEN", "Akses penerimaan dan inventory tidak tersedia.");
  return actor;
}
function failure(error: unknown): { error: string } {
  return {
    error:
      error instanceof Error
        ? error.message
        : "Sumber penerimaan belum dapat dibaca. Periksa lagi.",
  };
}
export function buildWarehouseIntakeTools(_context: AiToolContext): ToolSet {
  return {
    getWarehouseIntakeContext: tool({
      description:
        "Read-only authoritative warehouse intake sources. Choose resource: projects, locations, inventory, openings, receipts, stock_ins, rap_items or bills. Page20 with hasMore/nextOffset; stock_ins with intakeId reads the actual receiving lines; never silently truncate. Resolve human names using query (1 character allowed), then actual project/location/inventory/material/batch IDs. Inventory needs an explicitly chosen location; it shows stock, unit cost and opening eligibility; id:null means receiving can initialize inventory only at human confirmation, never fabricate an inventory ID for opening. Opening lists current tenant batches with maker identity and real items; requester-only access is restricted to own batches, approval/reversal grants allow their domain. Project sources obey ASSIGNED scope; explicit warehouse NONE grants retain domain-only project receiving. Bills require view:vendor_bill. Never choose first location, fabricate IDs, prices, measured stock, references or dates. Do not treat existing stock as a receipt or use stock-in to bypass opening readiness.",
      inputSchema: z
        .object({
          resource: z.enum([
            "projects",
            "locations",
            "inventory",
            "openings",
            "receipts",
            "stock_ins",
            "rap_items",
            "bills",
          ]),
          query: z.string().trim().min(1).max(120).optional(),
          projectId: z.string().guid().optional(),
          inventoryLocationId: z.string().guid().optional(),
          batchId: z.string().guid().optional(),
          intakeId: z.string().guid().optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await current();
          const page = <T>(
            rows: T[],
          ): { items: T[]; hasMore: boolean; nextOffset: number | null } => ({
            items: rows.slice(0, 20),
            hasMore: rows.length > 20,
            nextOffset: rows.length > 20 ? input.offset + 20 : null,
          });
          if (
            ["projects", "receipts", "stock_ins", "rap_items", "bills"].includes(input.resource) &&
            !actorCan(actor, "create:stock_movement")
          )
            throw new WarehouseIntakeError("FORBIDDEN", "Izin penerimaan material diperlukan.");
          if (input.resource === "projects")
            return page(
              await db.query.project.findMany({
                where: and(
                  eq(project.tenantId, INSTANCE_TENANT_ID),
                  inArray(project.status, ["DRAFT", "ACTIVE"]),
                  actor.dataScope === "ASSIGNED"
                    ? eq(project.projectManagerId, actor.userId)
                    : undefined,
                  input.query ? ilike(project.name, `%${input.query}%`) : undefined,
                ),
                columns: { id: true, name: true },
                orderBy: [asc(project.name), asc(project.id)],
                limit: 21,
                offset: input.offset,
              }),
            );
          if (input.resource === "locations")
            return page(
              await db.query.inventoryLocation.findMany({
                where: and(
                  eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
                  eq(inventoryLocation.isActive, true),
                  input.query ? ilike(inventoryLocation.name, `%${input.query}%`) : undefined,
                ),
                columns: { id: true, name: true },
                orderBy: [asc(inventoryLocation.name), asc(inventoryLocation.id)],
                limit: 21,
                offset: input.offset,
              }),
            );
          if (input.resource === "inventory") {
            if (!input.inventoryLocationId)
              return {
                status: "waiting_for_location",
                instruction: "Minta pengguna memilih lokasi penerimaan; baca resource locations.",
              };
            const location = await db.query.inventoryLocation.findFirst({
              where: and(
                eq(inventoryLocation.id, input.inventoryLocationId),
                eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
                eq(inventoryLocation.isActive, true),
              ),
              columns: { id: true, name: true },
            });
            if (!location)
              throw new WarehouseIntakeError("NOT_FOUND", "Lokasi aktif tidak ditemukan.");
            const inventories = await db
              .select({
                id: materialInventory.id,
                materialId: materialMaster.id,
                name: materialMaster.name,
                code: materialMaster.code,
                unit: materialMaster.unit,
                currentStock: materialInventory.currentStock,
                reservedStock: materialInventory.reservedStock,
                averageCost: materialInventory.averageCost,
              })
              .from(materialMaster)
              .leftJoin(
                materialInventory,
                and(
                  eq(materialMaster.id, materialInventory.materialId),
                  eq(materialInventory.locationId, location.id),
                  eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
                ),
              )
              .where(
                and(
                  eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
                  eq(materialMaster.isActive, true),
                  input.query
                    ? or(
                        ilike(materialMaster.name, `%${input.query}%`),
                        ilike(materialMaster.code, `%${input.query}%`),
                      )
                    : undefined,
                ),
              )
              .orderBy(asc(materialMaster.name), asc(materialMaster.id))
              .limit(21)
              .offset(input.offset);
            const inventory = await Promise.all(
              inventories.slice(0, 20).map(async (row) => {
                if (!row.id)
                  return {
                    ...row,
                    currentStock: "0.00",
                    reservedStock: "0.00",
                    averageCost: "0.00",
                    eligibleForOpening: false,
                    openingBlocker:
                      "Belum ada inventory di lokasi ini. Penerimaan akan membuatnya saat dikonfirmasi; saldo awal memakai inventory yang sudah terdaftar.",
                  };
                const [movement, pending] = await Promise.all([
                  db.query.stockMovement.findFirst({
                    where: and(
                      eq(stockMovement.materialId, row.materialId),
                      eq(stockMovement.inventoryLocationId, location.id),
                    ),
                    columns: { id: true },
                  }),
                  db
                    .select({ id: inventoryOpeningItem.id })
                    .from(inventoryOpeningItem)
                    .innerJoin(
                      inventoryOpeningBatch,
                      eq(inventoryOpeningBatch.id, inventoryOpeningItem.batchId),
                    )
                    .where(
                      and(
                        eq(inventoryOpeningItem.materialInventoryId, row.id),
                        eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
                      ),
                    )
                    .limit(1),
                ]);
                const reason = getOpeningInventoryIneligibleReason({
                  currentStock: Number(row.currentStock),
                  reservedStock: Number(row.reservedStock),
                  hasMovement: Boolean(movement),
                  hasPendingOpening: pending.length > 0,
                });
                return { ...row, eligibleForOpening: reason === null, openingBlocker: reason };
              }),
            );
            return {
              location,
              ...page(inventories),
              items: inventory,
              instruction:
                "Harga yang terlihat adalah biaya inventory saat ini; gunakan harga dokumen penerimaan yang diberikan manusia, jangan mengasumsikannya sebagai harga baru.",
            };
          }
          if (input.resource === "openings") {
            const full =
              actorCan(actor, "approve:opening_inventory") ||
              actorCan(actor, "reverse:opening_inventory");
            const batches = await db.query.inventoryOpeningBatch.findMany({
              where: and(
                eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
                full ? undefined : eq(inventoryOpeningBatch.requestedById, actor.userId),
                input.batchId ? eq(inventoryOpeningBatch.id, input.batchId) : undefined,
                input.query
                  ? ilike(inventoryOpeningBatch.batchNumber, `%${input.query}%`)
                  : undefined,
              ),
              columns: {
                id: true,
                batchNumber: true,
                status: true,
                requestedById: true,
                referenceNumber: true,
                cutoverDate: true,
                note: true,
              },
              orderBy: [asc(inventoryOpeningBatch.id)],
              limit: 21,
              offset: input.batchId ? 0 : input.offset,
            });
            let items: {
              id: string;
              materialInventoryId: string;
              quantity: string;
              unitCost: string;
            }[] = [];
            if (input.batchId && batches.length)
              items = await db.query.inventoryOpeningItem.findMany({
                where: and(
                  eq(inventoryOpeningItem.batchId, input.batchId),
                  eq(inventoryOpeningItem.tenantId, INSTANCE_TENANT_ID),
                ),
                columns: { id: true, materialInventoryId: true, quantity: true, unitCost: true },
                orderBy: [asc(inventoryOpeningItem.materialInventoryId)],
                limit: 21,
                offset: input.offset,
              });
            return {
              ...page(batches),
              items: batches.slice(0, 20).map((b) => ({
                ...b,
                status: formatBusinessLabel(b.status),
                makerIsYou: b.requestedById === actor.userId,
              })),
              batchItems: items.slice(0, 20),
              batchItemsHasMore: items.length > 20,
              batchItemsNextOffset: items.length > 20 ? input.offset + 20 : null,
            };
          }
          if (input.resource === "stock_ins" && input.intakeId) {
            const document = await db.query.warehouseIntake.findFirst({
              where: and(
                eq(warehouseIntake.id, input.intakeId),
                eq(warehouseIntake.tenantId, INSTANCE_TENANT_ID),
              ),
            });
            if (!document)
              throw new WarehouseIntakeError("NOT_FOUND", "Dokumen stok masuk tidak ditemukan.");
            const rows = await db
              .select({
                id: stockMovement.id,
                materialId: materialMaster.id,
                name: materialMaster.name,
                unit: materialMaster.unit,
                quantity: stockMovement.quantity,
                unitCost: stockMovement.unitCost,
              })
              .from(stockMovement)
              .innerJoin(materialMaster, eq(materialMaster.id, stockMovement.materialId))
              .where(
                and(
                  eq(stockMovement.referenceId, document.id),
                  eq(stockMovement.referenceType, "WAREHOUSE_INTAKE"),
                  eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
                  eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
                ),
              )
              .orderBy(asc(stockMovement.id))
              .limit(21)
              .offset(input.offset);
            return { intake: document, ...page(rows) };
          }
          if (input.resource === "stock_ins")
            return page(
              await db.query.warehouseIntake.findMany({
                where: and(
                  eq(warehouseIntake.tenantId, INSTANCE_TENANT_ID),
                  input.inventoryLocationId
                    ? eq(warehouseIntake.inventoryLocationId, input.inventoryLocationId)
                    : undefined,
                  input.query
                    ? ilike(warehouseIntake.referenceNumber, `%${input.query}%`)
                    : undefined,
                ),
                columns: {
                  id: true,
                  referenceNumber: true,
                  inventoryLocationId: true,
                  receivedAt: true,
                  note: true,
                },
                orderBy: [asc(warehouseIntake.id)],
                limit: 21,
                offset: input.offset,
              }),
            );
          if (!input.projectId)
            return {
              status: "waiting_for_project",
              instruction: "Minta pengguna memilih proyek; baca resource projects.",
            };
          const proj = await db.query.project.findFirst({
            where: and(
              eq(project.id, input.projectId),
              eq(project.tenantId, INSTANCE_TENANT_ID),
              actor.dataScope === "ASSIGNED"
                ? eq(project.projectManagerId, actor.userId)
                : undefined,
            ),
            columns: { id: true, name: true },
          });
          if (!proj) throw new WarehouseIntakeError("FORBIDDEN", "Proyek di luar akses Anda.");
          if (input.resource === "receipts")
            return page(
              await db.query.goodsReceipt
                .findMany({
                  where: and(
                    eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID),
                    eq(goodsReceipt.projectId, proj.id),
                    input.query ? ilike(goodsReceipt.receiptNumber, `%${input.query}%`) : undefined,
                  ),
                  columns: {
                    id: true,
                    receiptNumber: true,
                    inventoryLocationId: true,
                    status: true,
                    receivedAt: true,
                  },
                  orderBy: [asc(goodsReceipt.id)],
                  limit: 21,
                  offset: input.offset,
                })
                .then((rows) => rows.map((r) => ({ ...r, status: formatBusinessLabel(r.status) }))),
            );
          if (input.resource === "bills") {
            if (!actorCan(actor, "view:vendor_bill"))
              throw new WarehouseIntakeError(
                "FORBIDDEN",
                "Izin membaca tagihan vendor diperlukan.",
              );
            return page(
              await db.query.vendorBill.findMany({
                where: and(
                  eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
                  eq(vendorBill.projectId, proj.id),
                  input.query ? ilike(vendorBill.billNumber, `%${input.query}%`) : undefined,
                ),
                columns: {
                  id: true,
                  billNumber: true,
                  materialId: true,
                  projectRapItemId: true,
                  amount: true,
                },
                orderBy: [asc(vendorBill.id)],
                limit: 21,
                offset: input.offset,
              }),
            );
          }
          const rap = await db.query.projectRap.findFirst({
            where: and(
              eq(projectRap.projectId, proj.id),
              eq(projectRap.tenantId, INSTANCE_TENANT_ID),
            ),
            orderBy: (t, { desc }) => [desc(t.revision), desc(t.id)],
          });
          if (!rap) return { items: [], hasMore: false, nextOffset: null };
          return page(
            await db.query.projectRapItem.findMany({
              where: and(
                eq(projectRapItem.projectRapId, rap.id),
                eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
                input.query
                  ? or(
                      ilike(projectRapItem.name, `%${input.query}%`),
                      ilike(projectRapItem.area, `%${input.query}%`),
                    )
                  : undefined,
              ),
              columns: {
                id: true,
                materialId: true,
                name: true,
                area: true,
                unit: true,
                totalQuantity: true,
              },
              orderBy: [asc(projectRapItem.id)],
              limit: 21,
              offset: input.offset,
            }),
          );
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeWarehouseIntake: tool({
      description:
        "Read-only server-owned warehouse intake proposal. PROJECT_RECEIPT receives1–100 unique material/RAP lines to one explicit project/location with real supplied receipt number, date and unit costs; optional verified bill/RAP links enforce remaining receipt allowance. WAREHOUSE_STOCK_IN records1–100 company warehouse materials without a project, with human source/reference/date/costs; it creates no expense or cash. OPENING_REQUEST uses verified inventory IDs, supplied measured quantities, positive costs, source note, date and reference; only zero-stock/no-history inventory without another pending opening is eligible and stock stays unchanged until another user approves. OPENING_APPROVE requires independent checker and still-empty sources; REJECT requires reason and keeps stock. OPENING_REVERSE requires reason and no later movement or reservation. Never use opening for active inventory, override readiness, invent values, create materials/locations silently or issue payments. Corrections use a fresh proposal; only the explicit card/sheet button executes, atomically with audit and idempotent receipt. Measured counts use the existing stock-count workflow; explicit direct correction deltas use getStockCorrectionContext/proposeStockCorrection. Emergency adjustments remain manual.",
      inputSchema: warehouseIntakeInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareProcurementWarehouseProposal(await current(), input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
