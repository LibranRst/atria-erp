import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  materialMaster,
  inventoryLocation,
  materialInventory,
  stockMovement,
  projectBudgets,
  projectRap,
  projectRapItem,
  projectBudgetCategory,
  expenseCategory,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import {
  validateStockMovementLinksTx,
  stockCostAttributionTx,
} from "@backend/lib/material/stock-movement-links";
import {
  findLockedInventory,
  insertStockMovement,
  writeStockMovementAuditTx,
  recordStandaloneStockProjectCostTx,
} from "@backend/app/actions/material/inventory-utils";
import { calculateOutstandingProjectReservations } from "@atria/core/material/project-material-projection";
import { calculateNetProjectUsage } from "@atria/core/material/stock-guards";
import {
  projectStockRowInputSchema,
  projectStockPermission,
  previewProjectStock,
  type ProjectStockAction,
  type ProjectStockInput,
  type ProjectStockState,
} from "@atria/core/ai/project-stock";
import type { z } from "zod";
export type ProjectStockTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type StockActor = Pick<Actor, "userId" | "permissions" | "dataScope">;
export class ProjectStockError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function hasStockProjectScope(actor: StockActor): boolean {
  return actor.dataScope !== "NONE" || actorCan(actor, "create:stock_movement");
}
export async function lockStockProjectTx(
  tx: ProjectStockTx,
  actor: StockActor,
  projectId: string,
  action: ProjectStockAction,
): Promise<typeof project.$inferSelect> {
  if (!actorCan(actor, projectStockPermission(action)))
    throw new ProjectStockError("FORBIDDEN", "Izin pergerakan stok tidak tersedia.");
  const [proj] = await tx
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (
    !proj ||
    !hasStockProjectScope(actor) ||
    (actor.dataScope === "ASSIGNED" && proj.projectManagerId !== actor.userId)
  )
    throw new ProjectStockError("FORBIDDEN", "Proyek di luar akses Anda.");
  assertProjectStatusIsOperational(proj.status);
  await assertOperationalStockReadiness(tx);
  return proj;
}
type StockBudgetCategory = typeof projectBudgetCategory.$inferSelect & {
  expenseCategory: typeof expenseCategory.$inferSelect;
};
export type PreparedProjectStockRow = {
  input: z.output<typeof projectStockRowInputSchema>;
  project: typeof project.$inferSelect;
  material: typeof materialMaster.$inferSelect;
  location: typeof inventoryLocation.$inferSelect;
  inventory: typeof materialInventory.$inferSelect;
  movements: (typeof stockMovement.$inferSelect)[];
  links: Awaited<ReturnType<typeof validateStockMovementLinksTx>>;
  budget: (typeof projectBudgets.$inferSelect & { categories: StockBudgetCategory[] }) | undefined;
  materialBudget: StockBudgetCategory | null;
  rapItem:
    | (typeof projectRapItem.$inferSelect & { rap: typeof projectRap.$inferSelect })
    | null
    | undefined;
  latestRap:
    | (typeof projectRap.$inferSelect & { items: (typeof projectRapItem.$inferSelect)[] })
    | undefined;
  before: ProjectStockState;
  after: ProjectStockState;
  unitCost: number;
  attribution: Awaited<ReturnType<typeof stockCostAttributionTx>>;
};
export async function prepareProjectStockRowTx(
  tx: ProjectStockTx,
  actor: StockActor,
  projectId: string,
  action: ProjectStockAction,
  raw: z.input<typeof projectStockRowInputSchema>,
): Promise<PreparedProjectStockRow> {
  const input = projectStockRowInputSchema.parse({
      materialId: raw.materialId,
      inventoryLocationId: raw.inventoryLocationId,
      quantity: raw.quantity,
      projectRapItemId: raw.projectRapItemId,
      projectCostId: raw.projectCostId,
      vendorBillId: raw.vendorBillId,
      unitCost: raw.unitCost,
      note: raw.note,
    }),
    proj = await lockStockProjectTx(tx, actor, projectId, action);
  if (action === "WASTE" && input.note.trim().length < 10)
    throw new ProjectStockError("VALIDATION_ERROR", "Alasan waste minimal 10 karakter.");
  if (
    action === "RELEASE_RESERVATION" &&
    (input.projectCostId || input.vendorBillId || input.unitCost !== undefined)
  )
    throw new ProjectStockError(
      "VALIDATION_ERROR",
      "Pelepasan reservasi tidak memakai sumber biaya.",
    );
  const [material, location] = await Promise.all([
    tx
      .select()
      .from(materialMaster)
      .where(
        and(
          eq(materialMaster.id, input.materialId),
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update")
      .then((rows) => rows[0]),
    tx
      .select()
      .from(inventoryLocation)
      .where(
        and(
          eq(inventoryLocation.id, input.inventoryLocationId),
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update")
      .then((rows) => rows[0]),
  ]);
  if (!material || !location)
    throw new ProjectStockError("NOT_FOUND", "Material atau lokasi tidak tersedia.");
  const links = await validateStockMovementLinksTx(tx, { ...input, projectId });
  const inventory = await findLockedInventory(tx, input.materialId, input.inventoryLocationId);
  if (inventory.tenantId !== INSTANCE_TENANT_ID)
    throw new ProjectStockError("FORBIDDEN", "Inventory di luar akses Anda.");
  const movements = await tx.query.stockMovement.findMany({
    where: and(
      eq(stockMovement.projectId, projectId),
      eq(stockMovement.materialId, input.materialId),
      eq(stockMovement.inventoryLocationId, input.inventoryLocationId),
      eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
    ),
    orderBy: [asc(stockMovement.createdAt), asc(stockMovement.id)],
  });
  const matching = movements.filter((m) =>
    input.projectRapItemId ? m.projectRapItemId === input.projectRapItemId : !m.projectRapItemId,
  );
  const before: ProjectStockState = {
    current: Number(inventory.currentStock),
    reserved: Number(inventory.reservedStock),
    available: Number(
      (Number(inventory.currentStock) - Number(inventory.reservedStock)).toFixed(2),
    ),
    ownReserved: calculateOutstandingProjectReservations(matching),
    netUsed: calculateNetProjectUsage(
      matching.map((m) => ({ movementType: m.movementType, quantity: Number(m.quantity) })),
    ),
  };
  const after = previewProjectStock(action, before, input.quantity),
    unitCost = input.unitCost ?? Number(inventory.averageCost);
  if (
    action !== "RESERVE" &&
    action !== "RELEASE_RESERVATION" &&
    (!Number.isFinite(input.quantity * unitCost) || input.quantity * unitCost > 9999999999999.99)
  )
    throw new ProjectStockError(
      "VALIDATION_ERROR",
      "Nilai pemakaian/pengembalian melebihi batas nilai biaya material.",
    );
  const attribution =
    action === "RESERVE" || action === "RELEASE_RESERVATION"
      ? { amount: 0, quantity: 0 }
      : await stockCostAttributionTx(tx, links, {
          movementType: action,
          materialId: input.materialId,
          quantity: input.quantity,
          unitCost,
        });
  const budget = await tx.query.projectBudgets.findFirst({
    where: and(
      eq(projectBudgets.projectId, projectId),
      eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
    ),
    with: { categories: { with: { expenseCategory: true } } },
  });
  const materialBudget =
    budget?.categories.find((c) => c.expenseCategory.code === "MATERIAL") ?? null;
  if ((action === "RETURN" || attribution.amount !== 0) && !materialBudget)
    throw new ProjectStockError(
      "CONFLICT",
      "Budget kategori Material belum tersedia untuk realisasi stok.",
    );
  const rapItem = input.projectRapItemId
    ? await tx.query.projectRapItem.findFirst({
        where: eq(projectRapItem.id, input.projectRapItemId),
        with: { rap: true },
      })
    : null;
  const latestRap = await tx.query.projectRap.findFirst({
    where: eq(projectRap.projectId, projectId),
    orderBy: [desc(projectRap.revision), desc(projectRap.createdAt)],
    with: { items: true },
  });
  return {
    input,
    project: proj,
    material,
    location,
    inventory,
    movements,
    links,
    budget,
    materialBudget,
    rapItem,
    latestRap,
    before,
    after,
    unitCost,
    attribution,
  };
}

/** Only the shared explicit writer changes inventory, movements, non-cash actuals and audit. */
export async function writeProjectStockRowTx(
  tx: ProjectStockTx,
  actor: StockActor,
  projectId: string,
  action: ProjectStockAction,
  raw: z.input<typeof projectStockRowInputSchema>,
): Promise<typeof stockMovement.$inferSelect> {
  const row = await prepareProjectStockRowTx(tx, actor, projectId, action, raw),
    { input, inventory, after, attribution, unitCost } = row;
  await tx
    .update(materialInventory)
    .set({
      currentStock: after.current.toFixed(2),
      reservedStock: after.reserved.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(materialInventory.id, inventory.id));
  const movement = await insertStockMovement(tx, {
    ...input,
    projectId,
    movementType: action,
    quantity: input.quantity.toFixed(2),
    unitCost: unitCost.toFixed(2),
    createdById: actor.userId,
  });
  if (
    action !== "RESERVE" &&
    action !== "RELEASE_RESERVATION" &&
    (action === "RETURN" || attribution.amount !== 0)
  )
    await recordStandaloneStockProjectCostTx(tx, {
      movement,
      projectId,
      requestedById: actor.userId,
      quantity: Math.abs(attribution.quantity),
      unitCost,
      amount: attribution.amount,
      description:
        action === "RETURN"
          ? `Reversal biaya material yang dikembalikan dari proyek: ${input.note}`
          : action === "WASTE"
            ? `Waste material proyek: ${input.note}`
            : `Pemakaian stock existing untuk proyek: ${input.note}`,
      sourceType:
        action === "RETURN" ? "STOCK_RETURN" : action === "WASTE" ? "STOCK_WASTE" : "STOCK_USAGE",
      sign: action === "RETURN" ? -1 : 1,
    });
  await writeStockMovementAuditTx(tx, {
    userId: actor.userId,
    action:
      action === "RESERVE"
        ? "RESERVE_MATERIAL"
        : action === "USE"
          ? "USE_MATERIAL"
          : action === "RETURN"
            ? "RETURN_MATERIAL"
            : action === "WASTE"
              ? "WASTE_MATERIAL"
              : "RELEASE_MATERIAL_RESERVATION",
    inventoryId: inventory.id,
    originalState: { currentStock: inventory.currentStock, reservedStock: inventory.reservedStock },
    newState: {
      currentStock: after.current.toFixed(2),
      reservedStock: after.reserved.toFixed(2),
      stockMovementId: movement.id,
      nonCashCostDelta: attribution.amount,
    },
  });
  return movement;
}
export async function prepareProjectStockBatchTx(
  tx: ProjectStockTx,
  actor: StockActor,
  input: ProjectStockInput,
): Promise<PreparedProjectStockRow[]> {
  const rows: PreparedProjectStockRow[] = [];
  for (const row of [...input.rows].sort((a, b) =>
    `${a.materialId}:${a.inventoryLocationId}`.localeCompare(
      `${b.materialId}:${b.inventoryLocationId}`,
    ),
  ))
    rows.push(await prepareProjectStockRowTx(tx, actor, input.projectId, input.action, row));
  return input.rows.map((inputRow) => {
    const found = rows.find(
      (row) =>
        row.input.materialId === inputRow.materialId &&
        row.input.inventoryLocationId === inputRow.inventoryLocationId,
    );
    if (!found) throw new ProjectStockError("CONFLICT", "Baris stok tidak tersedia.");
    return found;
  });
}
