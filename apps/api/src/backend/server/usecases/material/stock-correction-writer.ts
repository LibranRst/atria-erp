import { and, asc, eq, inArray } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  materialMaster,
  inventoryLocation,
  materialInventory,
  project,
  user,
  role,
  rolePermission,
  stockMovement,
  projectCost,
  projectRapItem,
  vendorBill,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { FinanceTransaction } from "../finance/mutation-access";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { validateStockMovementLinksTx } from "@backend/lib/material/stock-movement-links";
import {
  insertStockMovement,
  writeStockMovementAuditTx,
} from "@backend/app/actions/material/inventory-utils";
import { parseNumericToCents, fromCents } from "@backend/lib/finance/balance-mutation";
import {
  stockCorrectionInputSchema,
  stockQuantitySchema,
  invoiceMoneySchema,
  type StockCorrectionInput,
} from "@atria/core/ai/procurement-warehouse";

export type StockCorrectionFailureContext = {
  readonly materialName: string;
  readonly inventoryLocationName: string;
  readonly unit: string;
  readonly currentStock: string;
  readonly reservedStock: string;
  readonly availableStock: string;
  readonly maximumDecrease: string;
};
export class StockCorrectionError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
    readonly stockContext?: StockCorrectionFailureContext,
  ) {
    super(message);
  }
}
export type StockCorrectionRow = {
  readonly input: StockCorrectionInput["items"][number];
  readonly material: typeof materialMaster.$inferSelect;
  readonly inventory: typeof materialInventory.$inferSelect;
  readonly after: string;
  readonly availableBefore: string;
  readonly availableAfter: string;
  readonly unitCost: string;
};
export type StockCorrectionSource = {
  readonly input: StockCorrectionInput;
  readonly location: typeof inventoryLocation.$inferSelect;
  readonly project: typeof project.$inferSelect | null;
  readonly rows: readonly StockCorrectionRow[];
};
export function stockCorrectionReferencePermissions(
  input: StockCorrectionInput,
): readonly PermissionKey[] {
  return [
    ...(input.items.some((item) => item.projectCostId) ? (["view:cost"] as const) : []),
    ...(input.items.some((item) => item.vendorBillId) ? (["view:vendor_bill"] as const) : []),
  ];
}
export async function assertStockCorrectionActorTx(
  tx: Pick<FinanceTransaction, "query" | "select">,
  actor: Actor,
  ai = false,
  additional: readonly PermissionKey[] = [],
): Promise<void> {
  const grants: PermissionKey[] = [
    "adjust:stock",
    ...(ai ? (["use:ai_chat", "view:material", "view:inventory"] as const) : []),
    ...additional,
  ];
  const [r] = await tx.select().from(role).where(eq(role.id, actor.roleId)).for("share");
  const [u] = await tx.select().from(user).where(eq(user.id, actor.userId)).for("share");
  const keys = await tx.query.rolePermission.findMany({
    where: eq(rolePermission.roleId, actor.roleId),
    columns: { permissionKey: true },
  });
  if (
    !r ||
    !u ||
    !actor.isActive ||
    !u.isActive ||
    u.roleId !== actor.roleId ||
    r.dataScope !== actor.dataScope ||
    (u.mustChangePassword && !actor.developerActorUserId) ||
    grants.some((key) => !actorCan(actor, key) || !keys.some((p) => p.permissionKey === key))
  )
    throw new StockCorrectionError(
      "FORBIDDEN",
      "Sesi atau izin koreksi stok berubah. Periksa akses akun Anda.",
    );
}
export async function readStockCorrectionTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: StockCorrectionInput,
  ai = false,
): Promise<StockCorrectionSource> {
  const parsed = stockCorrectionInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new StockCorrectionError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Data koreksi stok tidak valid.",
    );
  const input = parsed.data;
  await assertStockCorrectionActorTx(
    tx,
    actor,
    ai,
    ai ? stockCorrectionReferencePermissions(input) : [],
  );
  try {
    await assertOperationalStockReadiness(tx);
  } catch {
    throw new StockCorrectionError(
      "CONFLICT",
      "Finalkan kesiapan saldo awal stok di Pengaturan sebelum melakukan koreksi.",
    );
  }
  let p: typeof project.$inferSelect | null = null;
  if (actor.dataScope === "ASSIGNED" && !input.projectId)
    throw new StockCorrectionError(
      "FORBIDDEN",
      "Pilih proyek yang ditugaskan kepada Anda untuk koreksi ini.",
    );
  if (input.projectId) {
    if (actor.dataScope === "NONE")
      throw new StockCorrectionError(
        "FORBIDDEN",
        "Akses Anda hanya mencakup stok gudang tanpa proyek.",
      );
    const [row] = await tx
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, input.projectId),
          eq(project.tenantId, INSTANCE_TENANT_ID),
          actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
        ),
      )
      .for("update");
    if (!row) throw new StockCorrectionError("FORBIDDEN", "Proyek di luar akses Anda.");
    if (!["DRAFT", "ACTIVE"].includes(row.status))
      throw new StockCorrectionError("CONFLICT", "Proyek tidak menerima koreksi stok operasional.");
    p = row;
  }
  // Finance/RAP references lock before physical inventory, matching receiving.
  for (const item of input.items.toSorted((a, b) => a.materialId.localeCompare(b.materialId))) {
    const refs = [
      ...(item.projectCostId
        ? [
            await tx.query.projectCost.findFirst({
              where: and(
                eq(projectCost.id, item.projectCostId),
                eq(projectCost.tenantId, INSTANCE_TENANT_ID),
              ),
              columns: { id: true },
            }),
          ]
        : []),
      ...(item.vendorBillId
        ? [
            await tx.query.vendorBill.findFirst({
              where: and(
                eq(vendorBill.id, item.vendorBillId),
                eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
              ),
              columns: { id: true },
            }),
          ]
        : []),
      ...(item.projectRapItemId
        ? [
            await tx.query.projectRapItem.findFirst({
              where: and(
                eq(projectRapItem.id, item.projectRapItemId),
                eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
                ai ? eq(projectRapItem.materialId, item.materialId) : undefined,
              ),
              columns: { id: true },
            }),
          ]
        : []),
    ];
    if (refs.some((ref) => !ref))
      throw new StockCorrectionError(
        "VALIDATION_ERROR",
        "Rujukan koreksi tidak tersedia atau belum terhubung dengan material ini.",
      );
    try {
      await validateStockMovementLinksTx(tx, { ...item, projectId: input.projectId });
    } catch {
      throw new StockCorrectionError(
        "VALIDATION_ERROR",
        "Rujukan RAP, biaya Material atau tagihan tidak sesuai dengan material dan proyek ini.",
      );
    }
  }
  const materials = await tx
    .select()
    .from(materialMaster)
    .where(
      and(
        eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        inArray(
          materialMaster.id,
          input.items.map((item) => item.materialId),
        ),
      ),
    )
    .orderBy(asc(materialMaster.id))
    .for("share");
  const [location] = await tx
    .select()
    .from(inventoryLocation)
    .where(
      and(
        eq(inventoryLocation.id, input.inventoryLocationId),
        eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("share");
  if (!location || !location.isActive)
    throw new StockCorrectionError("NOT_FOUND", "Lokasi gudang tidak tersedia.");
  if (materials.length !== input.items.length || materials.some((m) => !m.isActive))
    throw new StockCorrectionError("NOT_FOUND", "Material tidak tersedia dalam perusahaan ini.");
  const inventory = await tx
    .select()
    .from(materialInventory)
    .where(
      and(
        eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        eq(materialInventory.locationId, location.id),
        inArray(
          materialInventory.materialId,
          input.items.map((item) => item.materialId),
        ),
      ),
    )
    .orderBy(asc(materialInventory.id))
    .for("update");
  const rows: StockCorrectionRow[] = [];
  for (const item of input.items) {
    const material = materials.find((m) => m.id === item.materialId),
      inv = inventory.find((i) => i.materialId === item.materialId);
    if (!material || !inv)
      throw new StockCorrectionError(
        "NOT_FOUND",
        "Stok material belum tersedia di lokasi ini. Gunakan penerimaan atau saldo awal yang sesuai.",
      );
    const current = parseNumericToCents(inv.currentStock),
      reserved = parseNumericToCents(inv.reservedStock),
      delta = parseNumericToCents(item.quantity.toFixed(2));
    if (current < 0n || reserved < 0n || reserved > current)
      throw new StockCorrectionError(
        "CONFLICT",
        "Data stok dan reservasi tidak konsisten. Periksa sumber stok terlebih dahulu.",
      );
    const after = item.direction === "INCREASE" ? current + delta : current - delta;
    if (after < reserved)
      throw new StockCorrectionError(
        "VALIDATION_ERROR",
        `Koreksi membuat stok lebih kecil dari jumlah yang direservasi. Stok terbaru ${Number(fromCents(current)).toLocaleString("id-ID")} ${material.unit}, direservasi ${Number(fromCents(reserved)).toLocaleString("id-ID")} ${material.unit}. Maksimal pengurangan ${Number(fromCents(current - reserved)).toLocaleString("id-ID")} ${material.unit}.`,
        {
          materialName: material.name,
          inventoryLocationName: location.name,
          unit: material.unit,
          currentStock: fromCents(current),
          reservedStock: fromCents(reserved),
          availableStock: fromCents(current - reserved),
          maximumDecrease: fromCents(current - reserved),
        },
      );
    if (!stockQuantitySchema.safeParse(Number(fromCents(after))).success)
      throw new StockCorrectionError(
        "VALIDATION_ERROR",
        "Hasil stok berada di luar batas yang didukung.",
      );
    const cost = item.unitCost ?? Number(inv.averageCost);
    if (!invoiceMoneySchema.safeParse(cost).success)
      throw new StockCorrectionError(
        "CONFLICT",
        "Harga pokok stok tidak valid. Periksa nilai persediaan terlebih dahulu.",
      );
    rows.push({
      input: item,
      material,
      inventory: inv,
      after: fromCents(after),
      availableBefore: fromCents(current - reserved),
      availableAfter: fromCents(after - reserved),
      unitCost: cost.toFixed(2),
    });
  }
  return { input, location, project: p, rows };
}
/** Shared manual/AI writer. The caller owns the transaction and explicit approval. */
export async function writeStockCorrectionTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: StockCorrectionInput,
  ai = false,
): Promise<readonly (typeof stockMovement.$inferSelect)[]> {
  const source = await readStockCorrectionTx(tx, actor, input, ai),
    movements: (typeof stockMovement.$inferSelect)[] = [];
  for (const row of source.rows) {
    await tx
      .update(materialInventory)
      .set({ currentStock: row.after, updatedAt: new Date() })
      .where(eq(materialInventory.id, row.inventory.id));
    const movement = await insertStockMovement(tx, {
      ...row.input,
      materialId: row.material.id,
      projectId: source.input.projectId,
      inventoryLocationId: source.location.id,
      movementType: "ADJUSTMENT",
      movementDirection: row.input.direction === "INCREASE" ? "IN" : "OUT",
      quantity: row.input.quantity.toFixed(2),
      unitCost: row.unitCost,
      note: row.input.note ?? source.input.reason,
      createdById: actor.userId,
    });
    await writeStockMovementAuditTx(tx, {
      userId: actor.userId,
      action: "ADJUST_MATERIAL_STOCK",
      inventoryId: row.inventory.id,
      originalState: {
        currentStock: row.inventory.currentStock,
        reservedStock: row.inventory.reservedStock,
        averageCost: row.inventory.averageCost,
      },
      newState: {
        currentStock: row.after,
        reservedStock: row.inventory.reservedStock,
        averageCost: row.inventory.averageCost,
        direction: row.input.direction,
        note: movement.note,
        stockMovementId: movement.id,
      },
    });
    movements.push(movement);
  }
  return movements;
}
