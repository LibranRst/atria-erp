import "server-only";

import { db } from "@/db";
import {
  inventoryLocation,
  materialInventory,
  materialMaster,
  project,
  projectRapItem,
} from "@/db/schema";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  canAccessProject,
  hasPermission,
  permissionDenied,
  PROJECT_ACCESS_DENIED,
  type AiToolContext,
} from "./context";
import { money, toNumber } from "./shared";

export function buildMaterialProposalTools(context: AiToolContext) {
  return {
    proposeGoodsReceipt: tool({
      description:
        "Prepare a proposal to record goods receipt (Stock In / Penerimaan Barang) into a warehouse or site inventory location. Calculates before/after stock on-hand and average unit cost. Does NOT write to DB.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
        materialId: z.guid().describe("The material id, obtained from getMaterialCatalog."),
        quantity: z.number().positive().describe("Quantity of material received."),
        unitCost: z
          .number()
          .nonnegative()
          .optional()
          .describe("Purchase price per unit in rupiah. Omit to use material's recent average cost."),
        inventoryLocationId: z
          .guid()
          .optional()
          .describe("Target warehouse/site location ID. Omit to use default central warehouse."),
        vendorBillId: z.guid().optional().describe("Optional linked vendor bill ID."),
        projectRapItemId: z.guid().optional().describe("Optional linked RAP item ID."),
        note: z.string().optional().describe("Delivery note, Surat Jalan number, or receipt remarks."),
      }),
      execute: async ({
        projectId,
        materialId,
        quantity,
        unitCost,
        inventoryLocationId,
        vendorBillId,
        projectRapItemId,
        note,
      }) => {
        if (!hasPermission(context, "create:stock_movement")) {
          return permissionDenied("pencatatan barang masuk (Goods Receipt)");
        }
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, projectId),
          columns: { name: true },
        });
        if (!projectRow) return PROJECT_ACCESS_DENIED;

        const materialRow = await db.query.materialMaster.findFirst({
          where: eq(materialMaster.id, materialId),
        });
        if (!materialRow) {
          return { error: "Material tidak ditemukan dalam katalog Material Master." };
        }

        let targetLocation = inventoryLocationId
          ? await db.query.inventoryLocation.findFirst({
              where: eq(inventoryLocation.id, inventoryLocationId),
            })
          : null;

        if (!targetLocation) {
          targetLocation = await db.query.inventoryLocation.findFirst({
            where: eq(inventoryLocation.isActive, true),
          });
        }

        if (!targetLocation) {
          return { error: "Lokasi gudang penerimaan belum dikonfigurasi di sistem." };
        }

        const currentInv = await db.query.materialInventory.findFirst({
          where: and(
            eq(materialInventory.materialId, materialId),
            eq(materialInventory.locationId, targetLocation.id),
          ),
        });

        const currentStock = currentInv ? toNumber(currentInv.currentStock) : 0;
        const currentAvgCost = currentInv ? toNumber(currentInv.averageCost) : 0;
        const effectiveUnitCost = unitCost ?? (currentAvgCost > 0 ? currentAvgCost : 0);
        const totalValue = Math.round(quantity * effectiveUnitCost);

        const nextStock = currentStock + quantity;
        const nextAvgCost =
          nextStock > 0
            ? Math.round(
                (currentStock * currentAvgCost + quantity * effectiveUnitCost) / nextStock,
              )
            : effectiveUnitCost;

        let rapItemName: string | null = null;
        if (projectRapItemId) {
          const rapItem = await db.query.projectRapItem.findFirst({
            where: eq(projectRapItem.id, projectRapItemId),
            columns: { name: true },
          });
          rapItemName = rapItem?.name ?? null;
        }

        const receiptNumber = `GR-${Date.now().toString().slice(-6)}`;
        const today = new Date().toISOString().slice(0, 10);

        return {
          proposal: {
            kind: "POST_GOODS_RECEIPT" as const,
            projectId,
            projectName: projectRow.name,
            materialId,
            materialName: materialRow.name,
            materialCode: materialRow.code ?? "-",
            unit: materialRow.unit,
            quantity,
            unitCost: money(String(effectiveUnitCost)),
            totalValue: money(String(totalValue)),
            inventoryLocationId: targetLocation.id,
            locationName: targetLocation.name,
            stockOnHandBefore: currentStock,
            stockOnHandAfter: nextStock,
            averageCostBefore: money(String(currentAvgCost)),
            averageCostAfter: money(String(nextAvgCost)),
            receiptNumber,
            receivedAt: today,
            vendorBillId: vendorBillId ?? null,
            projectRapItemId: projectRapItemId ?? null,
            rapItemName,
            note: note ?? "",
          },
          instruction:
            "Sampaikan ringkasan penerimaan barang kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),
  };
}
