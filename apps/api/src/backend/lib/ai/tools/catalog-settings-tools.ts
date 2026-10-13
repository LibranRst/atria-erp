import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  vendor,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
  materialMaster,
  materialInventory,
  inventoryLocation,
  expenseCategory,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  prepareCatalogSettingsProposal,
  CatalogSettingsError,
} from "@backend/server/usecases/settings/catalog-settings-writer";
import { catalogSettingsInputSchema } from "@atria/core/ai/catalog-settings";
import type { AiToolContext } from "./context";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId || !actorCan(actor, "use:ai_chat"))
    throw new CatalogSettingsError("FORBIDDEN", "Akses chat tidak tersedia.");
  return actor;
}
function failure(error: unknown): { error: string } {
  return {
    error:
      error instanceof CatalogSettingsError
        ? error.message
        : "Data belum lengkap atau sumber tidak valid. Periksa referensi dan isian; jangan menebak.",
  };
}
export function buildCatalogSettingsTools(context: AiToolContext): ToolSet {
  return {
    getCatalogSettingsContext: tool({
      description:
        "Read-only current tenant catalog before vendor, item/price library, template/components or inventory settings proposals. Actual IDs/current fields, active/inactive state and source precision.20 entries/page; continue hasMore, never truncate. Query one domain using its actual management grant, independent of role name/project scope. Full vendor contact/bank fields are only available with manage:vendors. Library references show names/IDs without bank data. Inventory defaults do not change physical stock; average cost is separate reasoned valuation. Template edits require complete components, retained IDs and human price source/date; omitted old components will be removed. Existing RAP/RAB snapshots are not automatically refreshed.",
      inputSchema: z
        .object({
          domain: z.enum(["vendors", "library", "inventory"]),
          id: z.string().guid().optional(),
          query: z.string().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await current(context),
            grant =
              input.domain === "vendors"
                ? "manage:vendors"
                : input.domain === "library"
                  ? "manage:item_library"
                  : "manage:material_settings";
          if (!actorCan(actor, grant))
            throw new CatalogSettingsError("FORBIDDEN", "Izin pengaturan terkait tidak tersedia.");
          if (input.domain === "vendors") {
            const rows = await db.query.vendor.findMany({
              where: and(
                eq(vendor.tenantId, INSTANCE_TENANT_ID),
                input.id ? eq(vendor.id, input.id) : undefined,
                input.query ? ilike(vendor.name, `%${input.query.trim()}%`) : undefined,
              ),
              orderBy: [asc(vendor.name), asc(vendor.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              vendors: rows.slice(0, 20),
              hasMore: rows.length > 20,
              nextOffset: rows.length > 20 ? input.offset + 20 : null,
            };
          }
          if (input.domain === "library") {
            const rows = await db.query.itemPriceLibrary.findMany({
              where: and(
                eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
                input.id ? eq(itemPriceLibrary.id, input.id) : undefined,
                input.query ? ilike(itemPriceLibrary.name, `%${input.query.trim()}%`) : undefined,
              ),
              with: {
                costComponents: {
                  orderBy: [
                    asc(itemPriceLibraryCostComponent.displayOrder),
                    asc(itemPriceLibraryCostComponent.id),
                  ],
                },
              },
              orderBy: [asc(itemPriceLibrary.name), asc(itemPriceLibrary.id)],
              limit: 21,
              offset: input.offset,
            });
            const categories = await db.query.expenseCategory.findMany({
              where: eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
              columns: { id: true, name: true, code: true },
            });
            const materials = await db.query.materialMaster.findMany({
              where: eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
              columns: { id: true, name: true, unit: true, isActive: true },
              orderBy: [asc(materialMaster.name), asc(materialMaster.id)],
              limit: 21,
              offset: input.offset,
            });
            const vendors = await db.query.vendor.findMany({
              where: eq(vendor.tenantId, INSTANCE_TENANT_ID),
              columns: { id: true, name: true, isActive: true },
              orderBy: [asc(vendor.name), asc(vendor.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              items: rows.slice(0, 20),
              categories,
              materials: materials.slice(0, 20),
              vendors: vendors.slice(0, 20),
              pages: {
                items: { hasMore: rows.length > 20 },
                materials: { hasMore: materials.length > 20 },
                vendors: { hasMore: vendors.length > 20 },
              },
              nextOffset: input.offset + 20,
            };
          }
          const rows = await db
            .select({
              id: materialInventory.id,
              materialId: materialMaster.id,
              name: materialMaster.name,
              unit: materialMaster.unit,
              isActive: materialMaster.isActive,
              locationId: inventoryLocation.id,
              locationName: inventoryLocation.name,
              currentStock: materialInventory.currentStock,
              reservedStock: materialInventory.reservedStock,
              minimumStock: materialInventory.minimumStock,
              averageCost: materialInventory.averageCost,
              lastPurchasePrice: materialInventory.lastPurchasePrice,
            })
            .from(materialInventory)
            .innerJoin(materialMaster, eq(materialMaster.id, materialInventory.materialId))
            .innerJoin(inventoryLocation, eq(inventoryLocation.id, materialInventory.locationId))
            .where(
              and(
                eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
                eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
                eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
                input.id ? eq(materialInventory.id, input.id) : undefined,
                input.query ? ilike(materialMaster.name, `%${input.query.trim()}%`) : undefined,
              ),
            )
            .orderBy(
              asc(materialMaster.name),
              asc(inventoryLocation.name),
              asc(materialInventory.id),
            )
            .limit(21)
            .offset(input.offset);
          return {
            inventories: rows.slice(0, 20),
            hasMore: rows.length > 20,
            nextOffset: rows.length > 20 ? input.offset + 20 : null,
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeCatalogSettings: tool({
      description:
        "Read-only immutable catalog settings review. Actual IDs, exact before/after and live domain permission. Vendor/item edits are partial patches and preserve omitted fields; use null explicitly to clear optional text/reference. Status does not alter prices/components. PRICING_TEMPLATE_SAVE replaces the complete component set: retain actual existing component IDs, show removals, max100, no invented margin/price/measurement/source/date/unit conversions. LIBRARY edits preserve existing template metadata/components. INVENTORY_DEFAULTS only minimum/reference purchase price; INVENTORY_VALUATION separately shows average-cost/inventory-value effects and requires human reason>=10. No physical/reserved stock, project snapshots/budget/actuals, bills or cash are changed. Never silently batch/truncate or submit: only human review buttons can execute. Corrections require fresh proposal.",
      inputSchema: catalogSettingsInputSchema,
      execute: async (input) => {
        try {
          const actor = await current(context);
          return { proposal: await prepareCatalogSettingsProposal(actor, input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
