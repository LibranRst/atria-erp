import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  materialMaster,
  inventoryLocation,
  materialInventory,
  stockMovement,
  projectRap,
  projectCost,
  vendorBill,
} from "@backend/db/schema";
import {
  canReadProjectStock,
  prepareProjectStockProposal,
  readStockProjectAccess,
  projectStockProposalErrorMessage,
} from "@backend/server/usecases/ai/project-stock-context";
import { ProjectStockError } from "@backend/server/usecases/material/project-stock-writer";
import { projectStockInputSchema } from "@atria/core/ai/project-stock";
import { actorCan } from "@backend/lib/auth/permissions";
import type { AiToolContext } from "./context";
export function buildProjectStockTools(actor: AiToolContext): ToolSet {
  return {
    getProjectStockContext: tool({
      description:
        "Read-only project stock lookup before RESERVE/USE/RETURN/RELEASE_RESERVATION/WASTE. Real project/material/location/RAP/cost/bill IDs only; page20 projects and50 stock/source rows, continue hasMore. ASSIGNED stays restricted; warehouse rights can access minimal project stock context without broad project/finance rights. Budget precedes stock detail when permitted. Confirm actual operation/quantity/source/note; return is physical unused material returning from previously recorded USE, not release of reservation. Stock usage can change noncash Material actuals; never claim budget/cash stays unchanged for USE/RETURN.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().max(100).optional(),
          materialQuery: z.string().max(100).optional(),
          materialId: z.string().guid().optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canReadProjectStock(actor))
          return { error: "Akses chat dan stok Material diperlukan." };
        try {
          if (!input.projectId) {
            const rows = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                eq(project.status, "ACTIVE"),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
                input.projectQuery
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name), asc(project.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              projects: rows.slice(0, 20),
              hasMore: rows.length > 20,
              nextOffset: rows.length > 20 ? input.offset + 20 : null,
              needsDisambiguation: rows.length > 1,
            };
          }
          const proj = await readStockProjectAccess(actor, input.projectId);
          const rows = await db
            .select({
              id: materialInventory.id,
              materialId: materialMaster.id,
              materialName: materialMaster.name,
              materialActive: materialMaster.isActive,
              unit: materialMaster.unit,
              inventoryLocationId: inventoryLocation.id,
              locationName: inventoryLocation.name,
              locationActive: inventoryLocation.isActive,
              current: materialInventory.currentStock,
              reserved: materialInventory.reservedStock,
              unitCost: materialInventory.averageCost,
            })
            .from(materialInventory)
            .innerJoin(materialMaster, eq(materialMaster.id, materialInventory.materialId))
            .innerJoin(inventoryLocation, eq(inventoryLocation.id, materialInventory.locationId))
            .where(
              and(
                eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
                eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
                eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
                input.materialId ? eq(materialMaster.id, input.materialId) : undefined,
                input.materialQuery
                  ? ilike(materialMaster.name, `%${input.materialQuery.trim()}%`)
                  : undefined,
              ),
            )
            .orderBy(
              asc(materialMaster.name),
              asc(inventoryLocation.name),
              asc(materialInventory.id),
            )
            .limit(51)
            .offset(input.offset);
          const rap = await db.query.projectRap.findMany({
            where: and(
              eq(projectRap.projectId, proj.id),
              eq(projectRap.tenantId, INSTANCE_TENANT_ID),
            ),
            with: { items: true },
            orderBy: [asc(projectRap.revision)],
          });
          const rapItems = rap.flatMap((r) =>
            r.items
              .filter((i) => !input.materialId || i.materialId === input.materialId)
              .map((i) => ({
                id: i.id,
                materialId: i.materialId,
                name: i.name,
                area: i.area,
                unit: i.unit,
                totalQuantity: i.totalQuantity,
                revision: r.revision,
                status: r.status,
              })),
          );
          const movements = await db.query.stockMovement.findMany({
            where: and(
              eq(stockMovement.projectId, proj.id),
              eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
              input.materialId ? eq(stockMovement.materialId, input.materialId) : undefined,
            ),
            columns: {
              id: true,
              materialId: true,
              inventoryLocationId: true,
              projectRapItemId: true,
              projectCostId: true,
              vendorBillId: true,
              movementType: true,
              quantity: true,
              unitCost: true,
            },
            orderBy: [asc(stockMovement.createdAt), asc(stockMovement.id)],
            limit: 51,
            offset: input.offset,
          });
          const costs = actorCan(actor, "view:cost")
            ? await db.query.projectCost.findMany({
                where: and(
                  eq(projectCost.projectId, proj.id),
                  input.materialId ? eq(projectCost.materialId, input.materialId) : undefined,
                ),
                columns: { id: true, materialId: true, projectRapItemId: true, description: true },
                orderBy: [asc(projectCost.id)],
                limit: 51,
                offset: input.offset,
              })
            : [];
          const bills = actorCan(actor, "view:vendor_bill")
            ? await db.query.vendorBill.findMany({
                where: and(
                  eq(vendorBill.projectId, proj.id),
                  input.materialId ? eq(vendorBill.materialId, input.materialId) : undefined,
                ),
                columns: {
                  id: true,
                  materialId: true,
                  projectRapItemId: true,
                  billNumber: true,
                },
                orderBy: [asc(vendorBill.id)],
                limit: 51,
                offset: input.offset,
              })
            : [];
          const budget = actorCan(actor, "view:budget")
            ? await db.query.projectBudgets.findFirst({
                where: (t, { eq: equal }) => equal(t.projectId, proj.id),
                with: { categories: { with: { expenseCategory: true } } },
              })
            : null;
          const category = budget?.categories.find((c) => c.expenseCategory.code === "MATERIAL");
          return {
            project: proj,
            budget: category
              ? {
                  allocated: category.allocatedAmount,
                  actual: category.actualAmount,
                  pending: category.pendingAmount,
                }
              : null,
            inventories: rows
              .slice(0, 50)
              .map((r) => ({ ...r, available: Number(r.current) - Number(r.reserved) })),
            inventoriesHasMore: rows.length > 50,
            rapItems: rapItems.slice(input.offset, input.offset + 50),
            rapItemsHasMore: rapItems.length > input.offset + 50,
            movements: movements.slice(0, 50),
            movementsHasMore: movements.length > 50,
            costs: costs.slice(0, 50),
            costsHasMore: costs.length > 50,
            bills: bills.slice(0, 50),
            billsHasMore: bills.length > 50,
            nextOffset: input.offset + 50,
            instruction:
              "Confirm actual action, source location, quantity and note. Ask whether linked RAP/cost/source is intended; never guess price overrides, consent or hidden sources. The proposal calculates exact own reservation/net usage across full server history.",
          };
        } catch (error: unknown) {
          return {
            error:
              error instanceof ProjectStockError
                ? error.message
                : "Konteks stok belum tersedia. Periksa proyek dan sumber.",
          };
        }
      },
    }),
    proposeProjectStock: tool({
      description:
        "Read-only prepare exact project stock preview; up to20 distinct material/location rows, one RESERVE/USE/RETURN/RELEASE_RESERVATION/WASTE action, explicit notes and optional validated Material RAP/cost/bill links. Default server average cost; only pass unitCost when the human explicitly supplied it. Never split/truncate silently, bypass other-project reservations or return more than used. Does not mutate inventory, expenses, cash or approvals; human review/confirmation backend is required. Release only own matching RAP reservation (not a physical return), no price/cost/bill override. WASTE is physical warehouse stock discarded, requires human reason >=10 characters, can affect noncash Material actuals, does not reduce prior USE or create cash. Corrections create a fresh proposal.",
      inputSchema: projectStockInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareProjectStockProposal(actor, input) };
        } catch (error: unknown) {
          return { error: projectStockProposalErrorMessage(error) };
        }
      },
    }),
  };
}
