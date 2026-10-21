import {
  assertReceiptScope,
  ReceiptReversalError,
} from "@backend/server/usecases/material/receipt-reversal-writer";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  vendor,
  formDraft,
  projectBudgets,
  projectBudgetCategory,
  projectCategoryPlanItem,
  projectRapItem,
  projectRap,
  materialMaster,
  materialInventory,
  inventoryLocation,
  stockCount,
  stockCountItem,
  goodsReceipt,
  goodsReceiptItem,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  prepareProcurementWarehouseProposal,
  ProcurementWarehouseError,
} from "@backend/server/usecases/ai/procurement-warehouse-context";
import {
  vendorBillOperationInputSchema,
  warehouseOperationInputSchema,
} from "@atria/core/ai/procurement-warehouse";
import { vendorBillDraftPayloadSchema } from "@atria/core/validations/vendor-bill-draft";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { AiToolContext } from "./context";
async function currentActor(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId || !actorCan(actor, "use:ai_chat"))
    throw new ProcurementWarehouseError("FORBIDDEN", "Akses chat tidak tersedia.");
  return actor;
}
function toolFailure(error: unknown): { error: string } {
  return {
    error:
      error instanceof ProcurementWarehouseError || error instanceof ReceiptReversalError
        ? error.message
        : "Data belum lengkap atau sumber tidak tersedia. Periksa pilihan dan minta informasi yang belum jelas; jangan menebak.",
  };
}
export function buildProcurementWarehouseTools(context: AiToolContext): ToolSet {
  return {
    getVendorBillContext: tool({
      description:
        "Read-only references before vendor invoice drafting/submission: actual scoped project/vendor/category/package/material/RAP IDs and owned ordinary VENDOR_BILL drafts.20 projects/vendors/drafts and50 reference rows per page; continue hasMore. Budget only when permitted. Unpaid bill creation is NOT payment approval. Material purchase is inventory asset, not instant Material realization. Ambiguous vendor/project/category/amount/due date require human clarification; don't derive a missing invoice amount from RAP costs. Multi-material invoices must not pretend to have one material/RAP link.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().max(100).optional(),
          vendorQuery: z.string().max(100).optional(),
          materialQuery: z.string().max(100).optional(),
          draftId: z.string().guid().optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await currentActor(context);
          if (!actorCan(actor, "create:vendor_bill") || actor.dataScope === "NONE")
            throw new ProcurementWarehouseError(
              "FORBIDDEN",
              "Akses pembuatan tagihan dan proyek diperlukan.",
            );
          const projectId = input.projectId;
          if (input.draftId) {
            const draft = await db.query.formDraft.findFirst({
              where: and(
                eq(formDraft.id, input.draftId),
                eq(formDraft.tenantId, INSTANCE_TENANT_ID),
                eq(formDraft.ownerUserId, actor.userId),
                eq(formDraft.formType, "VENDOR_BILL_CREATE"),
                eq(formDraft.status, "ACTIVE"),
              ),
            });
            if (!draft || draft.expiresAt <= new Date())
              throw new ProcurementWarehouseError("NOT_FOUND", "Draft milik Anda belum ditemukan.");
            const payload = vendorBillDraftPayloadSchema.parse(draft.payload);
            if (payload.projectId) {
              const accessible = await db.query.project.findFirst({
                where: and(
                  eq(project.id, payload.projectId),
                  eq(project.tenantId, INSTANCE_TENANT_ID),
                  actor.dataScope === "ASSIGNED"
                    ? eq(project.projectManagerId, actor.userId)
                    : undefined,
                ),
                columns: { id: true },
              });
              if (!accessible)
                throw new ProcurementWarehouseError("FORBIDDEN", "Proyek di luar akses Anda.");
            }
            return {
              draft: { id: draft.id, revision: draft.revision, payload },
              instruction:
                "Read project/category/vendor references next if correcting. Submission uses this owned draftId, never client supplied bill fields.",
            };
          }
          if (!projectId) {
            const projects = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                inArray(project.status, ["DRAFT", "ACTIVE"]),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
                input.projectQuery
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true, status: true },
              orderBy: [asc(project.name), asc(project.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              projects: projects
                .slice(0, 20)
                .map((p) => ({ ...p, status: formatBusinessLabel(p.status) })),
              hasMore: projects.length > 20,
              nextOffset: projects.length > 20 ? input.offset + 20 : null,
              needsDisambiguation: projects.length > 1,
            };
          }
          const accessible = await db.query.project.findFirst({
            where: and(
              eq(project.id, projectId),
              eq(project.tenantId, INSTANCE_TENANT_ID),
              actor.dataScope === "ASSIGNED"
                ? eq(project.projectManagerId, actor.userId)
                : undefined,
            ),
            columns: { id: true, name: true, status: true },
          });
          if (!accessible)
            throw new ProcurementWarehouseError("FORBIDDEN", "Proyek di luar akses Anda.");
          const budgets = await db.query.projectBudgets.findMany({
            where: and(
              eq(projectBudgets.projectId, projectId),
              eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
            ),
            columns: { id: true },
          });
          const categories = budgets.length
            ? await db.query.projectBudgetCategory.findMany({
                where: and(
                  eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
                  inArray(
                    projectBudgetCategory.projectBudgetId,
                    budgets.map((b) => b.id),
                  ),
                ),
                with: { budget: true, expenseCategory: true },
                orderBy: [asc(projectBudgetCategory.id)],
              })
            : [];
          const scopedCategories = categories.filter((c) => c.budget.projectId === projectId);
          const vendors = await db.query.vendor.findMany({
            where: and(
              eq(vendor.tenantId, INSTANCE_TENANT_ID),
              eq(vendor.isActive, true),
              input.vendorQuery ? ilike(vendor.name, `%${input.vendorQuery.trim()}%`) : undefined,
            ),
            columns: { id: true, name: true },
            orderBy: [asc(vendor.name), asc(vendor.id)],
            limit: 21,
            offset: input.offset,
          });
          const drafts = await db.query.formDraft.findMany({
            where: and(
              eq(formDraft.tenantId, INSTANCE_TENANT_ID),
              eq(formDraft.ownerUserId, actor.userId),
              eq(formDraft.projectId, projectId),
              eq(formDraft.formType, "VENDOR_BILL_CREATE"),
              eq(formDraft.status, "ACTIVE"),
            ),
            columns: { id: true, revision: true, payload: true, expiresAt: true },
            orderBy: [asc(formDraft.id)],
            limit: 21,
            offset: input.offset,
          });
          const packages = await db.query.projectCategoryPlanItem.findMany({
            where: and(
              eq(projectCategoryPlanItem.projectId, projectId),
              eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
            ),
            columns: { id: true, name: true, projectBudgetCategoryId: true, unit: true },
            orderBy: [asc(projectCategoryPlanItem.id)],
            limit: 51,
            offset: input.offset,
          });
          const rapItems = actorCan(actor, "view:material")
            ? await db
                .select({
                  id: projectRapItem.id,
                  materialId: projectRapItem.materialId,
                  name: projectRapItem.name,
                  area: projectRapItem.area,
                  unit: projectRapItem.unit,
                  revision: projectRap.revision,
                })
                .from(projectRapItem)
                .innerJoin(projectRap, eq(projectRap.id, projectRapItem.projectRapId))
                .where(
                  and(
                    eq(projectRap.projectId, projectId),
                    eq(projectRap.tenantId, INSTANCE_TENANT_ID),
                  ),
                )
                .orderBy(asc(projectRapItem.id))
                .limit(51)
                .offset(input.offset)
            : [];
          const materials = actorCan(actor, "view:material")
            ? await db.query.materialMaster.findMany({
                where: and(
                  eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
                  eq(materialMaster.isActive, true),
                  input.materialQuery
                    ? ilike(materialMaster.name, `%${input.materialQuery.trim()}%`)
                    : undefined,
                ),
                columns: { id: true, name: true, unit: true },
                orderBy: [asc(materialMaster.name), asc(materialMaster.id)],
                limit: 51,
                offset: input.offset,
              })
            : [];
          return {
            project: accessible,
            budget: actorCan(actor, "view:budget")
              ? scopedCategories.map((c) => ({
                  categoryId: c.id,
                  name: c.expenseCategory.name,
                  allocated: c.allocatedAmount,
                  actual: c.actualAmount,
                  pending: c.pendingAmount,
                }))
              : null,
            categories: scopedCategories.map((c) => ({
              id: c.id,
              name: c.expenseCategory.name,
              code: c.expenseCategory.code,
            })),
            vendors: vendors.slice(0, 20),
            drafts: drafts
              .filter((d) => d.expiresAt > new Date())
              .slice(0, 20)
              .map((d) => ({
                id: d.id,
                revision: d.revision,
                payload: vendorBillDraftPayloadSchema.parse(d.payload),
              })),
            packages: packages.slice(0, 50),
            rapItems: rapItems.slice(0, 50),
            materials: materials.slice(0, 50),
            pages: {
              vendors: { hasMore: vendors.length > 20, nextOffset: input.offset + 20 },
              drafts: { hasMore: drafts.length > 20, nextOffset: input.offset + 20 },
              references: {
                hasMore: Math.max(packages.length, rapItems.length, materials.length) > 50,
                nextOffset: input.offset + 50,
              },
            },
          };
        } catch (error: unknown) {
          return toolFailure(error);
        }
      },
    }),
    proposeVendorBill: tool({
      description:
        "Read-only immutable vendor invoice proposal. SAVE stores an ordinary owned vendor draft only after a human button; SUBMIT separately creates the unpaid bill from an existing owned draft. No payment, stock-in, automatic approval or unit conversion. Sources must be current user's private ai_chat attachment URLs; retain invoice line amounts/provenance and match their total exactly (include explicit tax/discount lines). If preview extraction says incomplete/truncated, request a smaller source or missing detail before proposing; don't claim full import. Max100 invoice lines. Corrections create a fresh proposal; existing drafts require actual revision. Use material/RAP link only for a single actual related material/category; leave absent for mixed invoices.",
      inputSchema: vendorBillOperationInputSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareProcurementWarehouseProposal(await currentActor(context), input),
          };
        } catch (error: unknown) {
          return toolFailure(error);
        }
      },
    }),
    getWarehouseContext: tool({
      description:
        "Read-only warehouse locations/inventory, receipt cancellation and stock-count references before transfers/count draft/submit/approve/reject.20 locations,50 inventory/count rows; continue paging. Actual physical measurements, date and reason must come from human/source, never inferred from system quantities. Count drafts/submission don't adjust stock; an independent checker approves. Ordinary emergency override remains manual. No project/finance access is implied by warehouse permissions.",
      inputSchema: z
        .object({
          inventoryLocationId: z.string().guid().optional(),
          locationQuery: z.string().max(100).optional(),
          materialQuery: z.string().max(100).optional(),
          stockCountId: z.string().guid().optional(),
          goodsReceiptId: z.string().guid().optional(),
          receiptQuery: z.string().max(100).optional(),
          projectId: z.string().guid().optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await currentActor(context);
          if (
            !actorCan(actor, "view:material") ||
            !actorCan(actor, "view:inventory") ||
            ![
              "transfer:stock",
              "create:stock_count",
              "approve:stock_count",
              "request:goods_receipt_reversal",
              "approve:goods_receipt_reversal",
            ].some((p) => actor.permissions.some((value) => value === p))
          )
            throw new ProcurementWarehouseError(
              "FORBIDDEN",
              "Akses operasi gudang tidak tersedia.",
            );
          if (input.goodsReceiptId || input.receiptQuery !== undefined || input.projectId) {
            if (
              !actorCan(actor, "request:goods_receipt_reversal") &&
              !actorCan(actor, "approve:goods_receipt_reversal")
            )
              throw new ReceiptReversalError(
                "FORBIDDEN",
                "Akses pembatalan penerimaan tidak tersedia.",
              );
            if (input.goodsReceiptId) {
              const receipt = await db.query.goodsReceipt.findFirst({
                where: and(
                  eq(goodsReceipt.id, input.goodsReceiptId),
                  eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID),
                ),
              });
              if (!receipt)
                throw new ReceiptReversalError("NOT_FOUND", "Penerimaan tidak tersedia.");
              const proj = await assertReceiptScope(db, actor, receipt.projectId);
              const items = await db.query.goodsReceiptItem.findMany({
                where: eq(goodsReceiptItem.goodsReceiptId, receipt.id),
                with: { material: true },
                orderBy: [asc(goodsReceiptItem.id)],
                limit: 51,
                offset: input.offset,
              });
              return {
                receipt: {
                  id: receipt.id,
                  receiptNumber: receipt.receiptNumber,
                  projectId: proj.id,
                  projectName: proj.name,
                  inventoryLocationId: receipt.inventoryLocationId,
                  status: formatBusinessLabel(receipt.status),
                  reversalReason: receipt.reversalReason,
                  makerIsYou: receipt.reversalRequestedById === actor.userId,
                },
                items: items.slice(0, 50).map((i) => ({
                  id: i.id,
                  materialId: i.materialId,
                  name: i.material.name,
                  unit: i.material.unit,
                  quantity: i.quantity,
                  unitCost: i.unitCost,
                  projectRapItemId: i.projectRapItemId,
                })),
                hasMore: items.length > 50,
                nextOffset: items.length > 50 ? input.offset + 50 : null,
              };
            }
            const receipts = await db
              .select({
                id: goodsReceipt.id,
                receiptNumber: goodsReceipt.receiptNumber,
                projectId: project.id,
                projectName: project.name,
                inventoryLocationId: goodsReceipt.inventoryLocationId,
                status: goodsReceipt.status,
                maker: goodsReceipt.reversalRequestedById,
              })
              .from(goodsReceipt)
              .innerJoin(project, eq(project.id, goodsReceipt.projectId))
              .where(
                and(
                  eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID),
                  eq(project.tenantId, INSTANCE_TENANT_ID),
                  actor.dataScope === "ASSIGNED"
                    ? eq(project.projectManagerId, actor.userId)
                    : undefined,
                  input.projectId ? eq(project.id, input.projectId) : undefined,
                  input.receiptQuery
                    ? ilike(goodsReceipt.receiptNumber, `%${input.receiptQuery.trim()}%`)
                    : undefined,
                  input.inventoryLocationId
                    ? eq(goodsReceipt.inventoryLocationId, input.inventoryLocationId)
                    : undefined,
                ),
              )
              .orderBy(asc(goodsReceipt.receiptNumber), asc(goodsReceipt.id))
              .limit(21)
              .offset(input.offset);
            return {
              receipts: receipts.slice(0, 20).map(({ maker, ...r }) => ({
                ...r,
                status: formatBusinessLabel(r.status),
                makerIsYou: maker === actor.userId,
              })),
              hasMore: receipts.length > 20,
              nextOffset: receipts.length > 20 ? input.offset + 20 : null,
            };
          }
          if (input.stockCountId) {
            const header = await db.query.stockCount.findFirst({
              where: and(
                eq(stockCount.id, input.stockCountId),
                eq(stockCount.tenantId, INSTANCE_TENANT_ID),
                actorCan(actor, "approve:stock_count")
                  ? undefined
                  : eq(stockCount.createdById, actor.userId),
              ),
            });
            if (!header)
              throw new ProcurementWarehouseError("NOT_FOUND", "Stock opname di luar akses Anda.");
            const items = await db.query.stockCountItem.findMany({
              where: eq(stockCountItem.stockCountId, header.id),
              with: { material: true },
              orderBy: [asc(stockCountItem.id)],
              limit: 51,
              offset: input.offset,
            });
            return {
              count: {
                id: header.id,
                countNumber: header.countNumber,
                inventoryLocationId: header.inventoryLocationId,
                status: formatBusinessLabel(header.status),
                makerIsYou: header.createdById === actor.userId,
                note: header.note,
              },
              items: items.slice(0, 50).map((i) => ({
                id: i.id,
                materialId: i.materialId,
                name: i.material.name,
                unit: i.material.unit,
                systemQuantity: i.systemQuantity,
                countedQuantity: i.countedQuantity,
              })),
              hasMore: items.length > 50,
              nextOffset: items.length > 50 ? input.offset + 50 : null,
            };
          }
          if (!input.inventoryLocationId) {
            const locations = await db.query.inventoryLocation.findMany({
              where: and(
                eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
                eq(inventoryLocation.isActive, true),
                input.locationQuery
                  ? ilike(inventoryLocation.name, `%${input.locationQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(inventoryLocation.name), asc(inventoryLocation.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              locations: locations.slice(0, 20),
              hasMore: locations.length > 20,
              nextOffset: locations.length > 20 ? input.offset + 20 : null,
            };
          }
          const location = await db.query.inventoryLocation.findFirst({
            where: and(
              eq(inventoryLocation.id, input.inventoryLocationId),
              eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
            ),
            columns: { id: true, name: true, isActive: true },
          });
          if (!location) throw new ProcurementWarehouseError("NOT_FOUND", "Lokasi tidak tersedia.");
          const inventories = await db
            .select({
              materialId: materialMaster.id,
              name: materialMaster.name,
              unit: materialMaster.unit,
              active: materialMaster.isActive,
              physical: materialInventory.currentStock,
              reserved: materialInventory.reservedStock,
              averageCost: materialInventory.averageCost,
            })
            .from(materialInventory)
            .innerJoin(materialMaster, eq(materialMaster.id, materialInventory.materialId))
            .where(
              and(
                eq(materialInventory.locationId, location.id),
                eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
                eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
                input.materialQuery
                  ? ilike(materialMaster.name, `%${input.materialQuery.trim()}%`)
                  : undefined,
              ),
            )
            .orderBy(asc(materialMaster.name), asc(materialMaster.id))
            .limit(51)
            .offset(input.offset);
          const counts = await db.query.stockCount.findMany({
            where: and(
              eq(stockCount.tenantId, INSTANCE_TENANT_ID),
              eq(stockCount.inventoryLocationId, location.id),
              actorCan(actor, "approve:stock_count")
                ? undefined
                : eq(stockCount.createdById, actor.userId),
              inArray(stockCount.status, ["DRAFT", "PENDING_APPROVAL"]),
            ),
            columns: { id: true, countNumber: true, status: true, createdById: true },
            orderBy: [asc(stockCount.id)],
            limit: 51,
            offset: input.offset,
          });
          return {
            location,
            inventory: inventories.slice(0, 50),
            counts: counts.slice(0, 50).map((c) => ({
              id: c.id,
              countNumber: c.countNumber,
              status: formatBusinessLabel(c.status),
              makerIsYou: c.createdById === actor.userId,
            })),
            hasMore: Math.max(inventories.length, counts.length) > 50,
            nextOffset: Math.max(inventories.length, counts.length) > 50 ? input.offset + 50 : null,
          };
        } catch (error: unknown) {
          return toolFailure(error);
        }
      },
    }),
    proposeWarehouseOperation: tool({
      description:
        "Read-only immutable warehouse decision preview with real stock before/after. TRANSFER max20 unique materials, protects reservation, weighted destination valuation. COUNT_SAVE max100 actual human-measured materials and human note; stores Draft only. COUNT_SUBMIT requests approval. COUNT_APPROVE applies existing pending count through independent checker, unchanged stock and reservation guards; self-approval/emergency override is manual. COUNT_REJECT requires human reason and changes no stock. RECEIPT_REVERSAL_REQUEST needs a human reason and requests independent approval without changing stock; APPROVE cancels the entire actual receipt only by a different user with remaining-stock/value/reservation checks; REJECT requires a human reason and changes no stock. Read actual receipt IDs using getWarehouseContext receiptQuery (empty lists receipts), projectId or goodsReceiptId; never invent IDs or emergency override. No expense or cash transaction. Never fabricate measurements, auto-convert units, skip rows or silently create missing materials/locations. Corrections require a new proposal and explicit human button.",
      inputSchema: warehouseOperationInputSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareProcurementWarehouseProposal(await currentActor(context), input),
          };
        } catch (error: unknown) {
          return toolFailure(error);
        }
      },
    }),
  };
}
