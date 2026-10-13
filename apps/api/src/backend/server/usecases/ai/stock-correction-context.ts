import { createHash } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  inventoryLocation,
  materialMaster,
  materialInventory,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  stockMovement,
  projectCost,
  projectRapItem,
  vendorBill,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { FinanceTransaction } from "../finance/mutation-access";
import {
  assertStockCorrectionActorTx,
  readStockCorrectionTx,
  StockCorrectionError,
} from "../material/stock-correction-writer";
import {
  procurementWarehouseProposalSchema,
  type ProcurementWarehouseProposal,
  type StockCorrectionInput,
} from "@atria/core/ai/procurement-warehouse";
type Fact = ProcurementWarehouseProposal["summary"][number];
const fact = (label: string, value: string | number, money = false): Fact => ({
  label,
  value,
  money,
});
export async function prepareStockCorrectionProposalTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: StockCorrectionInput,
): Promise<ProcurementWarehouseProposal> {
  const source = await readStockCorrectionTx(tx, actor, input, true);
  const budget: Fact[] = [];
  if (source.project && actorCan(actor, "view:budget")) {
    const [category] = await tx
      .select({
        allocation: projectBudgetCategory.allocatedAmount,
        actual: projectBudgetCategory.actualAmount,
        remaining: projectBudgetCategory.remainingAmount,
        pending: projectBudgetCategory.pendingAmount,
      })
      .from(projectBudgetCategory)
      .innerJoin(projectBudgets, eq(projectBudgets.id, projectBudgetCategory.projectBudgetId))
      .innerJoin(expenseCategory, eq(expenseCategory.id, projectBudgetCategory.expenseCategoryId))
      .where(
        and(
          eq(projectBudgets.projectId, source.project.id),
          eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
          eq(expenseCategory.code, "MATERIAL"),
        ),
      );
    if (!category) budget.push(fact("Budget Material", "Belum tersedia"));
    if (category)
      budget.push(
        fact("Alokasi Material", Number(category.allocation), true),
        fact("Terpakai", Number(category.actual), true),
        fact("Menunggu persetujuan", Number(category.pending), true),
        fact("Sisa alokasi", Number(category.remaining), true),
      );
  }
  const references: unknown[] = [];
  const referenceFacts = new Map<string, Fact[]>();
  for (const item of input.items) {
    const labels: Fact[] = [];
    if (item.projectCostId) {
      const row = await tx.query.projectCost.findFirst({
        where: eq(projectCost.id, item.projectCostId),
      });
      references.push(row);
      if (row) labels.push(fact("Pengeluaran terkait", row.description));
    }
    if (item.projectRapItemId) {
      const row = await tx.query.projectRapItem.findFirst({
        where: eq(projectRapItem.id, item.projectRapItemId),
      });
      references.push(row);
      if (row) labels.push(fact("RAP terkait", `${row.name} · ${row.area}`));
    }
    if (item.vendorBillId) {
      const row = await tx.query.vendorBill.findFirst({
        where: eq(vendorBill.id, item.vendorBillId),
      });
      references.push(row);
      if (row) labels.push(fact("Tagihan terkait", row.billNumber));
    }
    referenceFacts.set(item.materialId, labels);
  }
  return procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: "STOCK_CORRECT",
    input: source.input,
    title: "Koreksi stok",
    entityName: source.rows.length === 1 ? source.rows[0].material.name : source.location.name,
    meta:
      source.rows.length === 1
        ? `${source.location.name} · ${source.rows[0].material.unit}${source.project ? ` · ${source.project.name}` : ""}`
        : `${source.rows.length} material · ${source.project?.name ?? "Stok gudang perusahaan"}`,
    projectId: source.project?.id ?? null,
    contextHash: createHash("sha256")
      .update(JSON.stringify([source, references, budget]))
      .digest("hex"),
    effect:
      "Koreksi memperbarui stok fisik dan mencatat pergerakan serta alasan audit. Reservasi, harga pokok, budget dan kas tetap.",
    rows: source.rows.map((row) => ({
      id: row.inventory.id,
      title: row.material.name,
      meta: row.material.unit,
      amount: row.input.unitCost === undefined ? null : Number(row.unitCost),
      comparisons: [
        {
          label: `Stok fisik (${row.material.unit})`,
          before: Number(row.inventory.currentStock),
          after: Number(row.after),
          money: false,
        },
        {
          label: `Stok tersedia (${row.material.unit})`,
          before: Number(row.availableBefore),
          after: Number(row.availableAfter),
          money: false,
        },
      ],
      details: [
        fact(
          "Koreksi",
          `${row.input.direction === "INCREASE" ? "+" : "−"}${row.input.quantity.toLocaleString("id-ID")} ${row.material.unit}`,
        ),
        fact(
          "Direservasi",
          `${Number(row.inventory.reservedStock).toLocaleString("id-ID")} ${row.material.unit}`,
        ),
        fact("Harga pokok pergerakan", Number(row.unitCost), true),
        fact("Alasan audit", row.input.note ?? input.reason),
        ...(referenceFacts.get(row.material.id) ?? []),
      ],
    })),
    summary: [
      fact(
        "Material",
        source.rows.length === 1 ? source.rows[0].material.name : source.rows.length,
      ),
      fact("Lokasi", source.location.name),
      fact("Alasan audit", input.reason),
    ],
    budget: budget.length ? budget : null,
  });
}
export type StockCorrectionContextQuery = {
  readonly resource: "locations" | "inventory" | "projects" | "history";
  readonly query?: string;
  readonly inventoryLocationId?: string;
  readonly projectId?: string;
  readonly offset: number;
};
export async function getStockCorrectionContext(
  actor: Actor,
  input: StockCorrectionContextQuery,
): Promise<unknown> {
  return db.transaction(async (tx) => {
    await assertStockCorrectionActorTx(tx, actor, true);
    const paginate = <T>(
      rows: T[],
    ): { items: T[]; hasMore: boolean; nextOffset: number | null } => ({
      items: rows.slice(0, 20),
      hasMore: rows.length > 20,
      nextOffset: rows.length > 20 ? input.offset + 20 : null,
    });
    if (input.resource === "locations")
      return paginate(
        await tx.query.inventoryLocation.findMany({
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
    if (input.resource === "projects") {
      if (actor.dataScope === "NONE")
        throw new StockCorrectionError(
          "FORBIDDEN",
          "Akses koreksi Anda mencakup gudang tanpa proyek.",
        );
      return paginate(
        await tx.query.project.findMany({
          where: and(
            eq(project.tenantId, INSTANCE_TENANT_ID),
            inArray(project.status, ["DRAFT", "ACTIVE"]),
            actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
            input.query ? ilike(project.name, `%${input.query}%`) : undefined,
          ),
          columns: { id: true, name: true },
          orderBy: [asc(project.name), asc(project.id)],
          limit: 21,
          offset: input.offset,
        }),
      );
    }
    if (!input.inventoryLocationId)
      throw new StockCorrectionError(
        "VALIDATION_ERROR",
        "Pilih lokasi gudang sebelum membaca stok.",
      );
    const location = await tx.query.inventoryLocation.findFirst({
      where: and(
        eq(inventoryLocation.id, input.inventoryLocationId),
        eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
        eq(inventoryLocation.isActive, true),
      ),
      columns: { id: true },
    });
    if (!location) throw new StockCorrectionError("NOT_FOUND", "Lokasi gudang tidak tersedia.");
    if (input.resource === "inventory")
      return paginate(
        await tx
          .select({
            inventoryId: materialInventory.id,
            materialId: materialMaster.id,
            name: materialMaster.name,
            unit: materialMaster.unit,
            currentStock: materialInventory.currentStock,
            reservedStock: materialInventory.reservedStock,
            averageCost: materialInventory.averageCost,
          })
          .from(materialInventory)
          .innerJoin(materialMaster, eq(materialMaster.id, materialInventory.materialId))
          .where(
            and(
              eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
              eq(materialInventory.locationId, location.id),
              eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
              eq(materialMaster.isActive, true),
              input.query ? ilike(materialMaster.name, `%${input.query}%`) : undefined,
            ),
          )
          .orderBy(asc(materialMaster.name), asc(materialInventory.id))
          .limit(21)
          .offset(input.offset),
      );
    if (actor.dataScope === "ASSIGNED" && !input.projectId)
      throw new StockCorrectionError(
        "FORBIDDEN",
        "Pilih proyek yang ditugaskan untuk membaca riwayat koreksi.",
      );
    if (input.projectId) {
      const p = await tx.query.project.findFirst({
        where: and(
          eq(project.id, input.projectId),
          eq(project.tenantId, INSTANCE_TENANT_ID),
          actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
        ),
        columns: { id: true },
      });
      if (!p || actor.dataScope === "NONE")
        throw new StockCorrectionError("FORBIDDEN", "Proyek di luar akses Anda.");
    }
    return paginate(
      await tx.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
          eq(stockMovement.inventoryLocationId, location.id),
          eq(stockMovement.movementType, "ADJUSTMENT"),
          input.projectId
            ? eq(stockMovement.projectId, input.projectId)
            : actor.dataScope === "NONE"
              ? isNull(stockMovement.projectId)
              : undefined,
          input.query ? ilike(stockMovement.note, `%${input.query}%`) : undefined,
        ),
        columns: {
          id: true,
          materialId: true,
          quantity: true,
          movementDirection: true,
          unitCost: true,
          note: true,
          createdAt: true,
        },
        orderBy: [desc(stockMovement.createdAt), desc(stockMovement.id)],
        limit: 21,
        offset: input.offset,
      }),
    );
  });
}
