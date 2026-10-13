import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  project,
  projectRap,
  projectRapItem,
  vendorBill,
  inventoryLocation,
  materialMaster,
  materialInventory,
  goodsReceipt,
  stockMovement,
  warehouseIntake,
  inventoryOpeningBatch,
  inventoryOpeningItem,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { validateStockMovementLinksTx } from "@backend/lib/material/stock-movement-links";
import { WarehouseIntakeError } from "../material/warehouse-intake-writer";
import type { FinanceTransaction } from "../finance/mutation-access";
import { calculateTransferDestinationAverage } from "@atria/core/material/stock-valuation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  procurementWarehouseProposalSchema,
  stockQuantitySchema,
  invoiceMoneySchema,
  type WarehouseIntakeInput,
  type ProcurementWarehouseProposal,
} from "@atria/core/ai/procurement-warehouse";

type InventorySource = {
  inventory: typeof materialInventory.$inferSelect;
  material: typeof materialMaster.$inferSelect;
  location: typeof inventoryLocation.$inferSelect;
};
type ReceiptSource = Omit<InventorySource, "inventory"> & {
  inventory: typeof materialInventory.$inferSelect | null;
};
type Fact = ProcurementWarehouseProposal["summary"][number];
const fact = (label: string, value: string | number, money = false): Fact => ({
  label,
  value,
  money,
});

async function sourceInventory(
  tx: FinanceTransaction,
  inventoryId: string,
): Promise<InventorySource> {
  const [inventory] = await tx
    .select()
    .from(materialInventory)
    .where(
      and(
        eq(materialInventory.id, inventoryId),
        eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!inventory)
    throw new WarehouseIntakeError("NOT_FOUND", "Inventory tidak ditemukan di perusahaan ini.");
  const material = await tx.query.materialMaster.findFirst({
    where: and(
      eq(materialMaster.id, inventory.materialId),
      eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  const location = await tx.query.inventoryLocation.findFirst({
    where: and(
      eq(inventoryLocation.id, inventory.locationId),
      eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!material || !location)
    throw new WarehouseIntakeError("NOT_FOUND", "Material atau lokasi tidak tersedia.");
  return { inventory, material, location };
}
function requireActive(source: Pick<InventorySource, "material" | "location">): void {
  if (!source.material.isActive || !source.location.isActive)
    throw new WarehouseIntakeError(
      "CONFLICT",
      "Material atau lokasi sudah nonaktif. Minta preview terbaru setelah diperbaiki.",
    );
}
async function history(
  tx: FinanceTransaction,
  source: InventorySource,
): Promise<(typeof stockMovement.$inferSelect)[]> {
  return tx.query.stockMovement.findMany({
    where: and(
      eq(stockMovement.tenantId, INSTANCE_TENANT_ID),
      eq(stockMovement.materialId, source.material.id),
      eq(stockMovement.inventoryLocationId, source.location.id),
    ),
    orderBy: [asc(stockMovement.id)],
  });
}

export async function prepareWarehouseIntakeProposalTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: WarehouseIntakeInput,
): Promise<ProcurementWarehouseProposal> {
  let title = "",
    entityName = "",
    meta = "",
    effect = "",
    projectId: string | null = null;
  const rows: ProcurementWarehouseProposal["rows"] = [],
    summary: Fact[] = [],
    snapshot: unknown[] = [];
  let budget: Fact[] | null = null;
  if (input.action === "PROJECT_RECEIPT" || input.action === "WAREHOUSE_STOCK_IN") {
    await assertOperationalStockReadiness(tx);
    const location = await tx.query.inventoryLocation.findFirst({
      where: and(
        eq(inventoryLocation.id, input.inventoryLocationId),
        eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
        eq(inventoryLocation.isActive, true),
      ),
    });
    if (!location)
      throw new WarehouseIntakeError("NOT_FOUND", "Lokasi penerimaan aktif belum dipilih.");
    snapshot.push(location);
    entityName = location.name;
    const reference =
      input.action === "PROJECT_RECEIPT" ? input.receiptNumber : input.referenceNumber;
    meta = `${reference} · ${location.name}`;
    title = input.action === "PROJECT_RECEIPT" ? "Penerimaan material proyek" : "Stok masuk gudang";
    if (input.action === "PROJECT_RECEIPT") {
      const [proj] = await tx
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
      if (!proj)
        throw new WarehouseIntakeError("FORBIDDEN", "Proyek penerimaan di luar akses Anda.");
      assertProjectStatusIsOperational(proj.status);
      snapshot.push(proj);
      projectId = proj.id;
      entityName = proj.name;
      if (
        await tx.query.goodsReceipt.findFirst({
          where: eq(goodsReceipt.receiptNumber, input.receiptNumber),
        })
      )
        throw new WarehouseIntakeError("CONFLICT", "Nomor penerimaan sudah digunakan.");
      if (actorCan(actor, "view:budget")) {
        const b = await tx.query.projectBudgets.findFirst({
          where: (t, { eq: equal }) =>
            and(equal(t.projectId, proj.id), equal(t.tenantId, INSTANCE_TENANT_ID)),
          with: { categories: { with: { expenseCategory: true } } },
        });
        snapshot.push(b);
        const category = b?.categories.find((c) => c.expenseCategory.code === "MATERIAL");
        budget = category
          ? [
              fact("Alokasi Material", Number(category.allocatedAmount), true),
              fact("Realisasi Material", Number(category.actualAmount), true),
              fact("Menunggu review", Number(category.pendingAmount), true),
              fact("Sisa Material", Number(category.remainingAmount), true),
              fact("Dampak penerimaan", "Realisasi dan kas tetap; pembayaran dicatat terpisah."),
            ]
          : [fact("Budget Material", "Belum tersedia")];
      }
      if (input.vendorBillId) {
        const [bill] = await tx
          .select()
          .from(vendorBill)
          .where(
            and(
              eq(vendorBill.id, input.vendorBillId),
              eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
              eq(vendorBill.projectId, proj.id),
            ),
          )
          .for("update");
        if (!bill)
          throw new WarehouseIntakeError(
            "VALIDATION_ERROR",
            "Tagihan vendor tidak sesuai proyek penerimaan.",
          );
        const received = await tx.query.stockMovement.findMany({
          where: and(
            eq(stockMovement.vendorBillId, bill.id),
            inArray(stockMovement.movementType, ["GOODS_RECEIPT", "GOODS_RECEIPT_REVERSAL"]),
          ),
          orderBy: [asc(stockMovement.id)],
        });
        const value = received.reduce(
          (sum, r) =>
            sum +
            (r.movementType === "GOODS_RECEIPT_REVERSAL" ? -1 : 1) *
              Number(r.quantity) *
              Number(r.unitCost),
          0,
        );
        if (
          value + input.items.reduce((sum, r) => sum + r.quantity * r.unitCost, 0) >
          Number(bill.amount) + 0.01
        )
          throw new WarehouseIntakeError(
            "VALIDATION_ERROR",
            "Nilai penerimaan melebihi sisa tagihan vendor.",
          );
        snapshot.push(bill, received);
        summary.push(fact("Tagihan vendor", bill.billNumber));
      }
    } else if (
      await tx.query.warehouseIntake.findFirst({
        where: and(
          eq(warehouseIntake.tenantId, INSTANCE_TENANT_ID),
          eq(warehouseIntake.referenceNumber, input.referenceNumber),
        ),
      })
    ) {
      throw new WarehouseIntakeError("CONFLICT", "Referensi stok masuk sudah dicatat.");
    }
    const sources = new Map<string, ReceiptSource>();
    const rapNames = new Map<string, string>();
    for (const item of input.items.toSorted((a, b) => a.materialId.localeCompare(b.materialId))) {
      const [material] = await tx
        .select()
        .from(materialMaster)
        .where(
          and(
            eq(materialMaster.id, item.materialId),
            eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("update");
      if (!material)
        throw new WarehouseIntakeError("NOT_FOUND", "Material tidak ditemukan di perusahaan ini.");
      const [inv] = await tx
        .select()
        .from(materialInventory)
        .where(
          and(
            eq(materialInventory.materialId, item.materialId),
            eq(materialInventory.locationId, location.id),
            eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("update");
      const source: ReceiptSource = { inventory: inv ?? null, material, location };
      requireActive(source);
      sources.set(item.materialId, source);
      snapshot.push(source);
      if (input.action === "PROJECT_RECEIPT") {
        const rapItemId =
          "projectRapItemId" in item && typeof item.projectRapItemId === "string"
            ? item.projectRapItemId
            : undefined;
        await validateStockMovementLinksTx(tx, {
          projectId: input.projectId,
          materialId: item.materialId,
          projectRapItemId: rapItemId,
          vendorBillId: input.vendorBillId,
        });
        if (rapItemId) {
          const [rapItem] = await tx
            .select()
            .from(projectRapItem)
            .where(
              and(
                eq(projectRapItem.id, rapItemId),
                eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
              ),
            )
            .for("update");
          const rap = rapItem
            ? await tx.query.projectRap.findFirst({
                where: eq(projectRap.id, rapItem.projectRapId),
              })
            : null;
          if (
            !rapItem ||
            !rap ||
            rap.projectId !== input.projectId ||
            rapItem.materialId !== item.materialId
          )
            throw new WarehouseIntakeError(
              "VALIDATION_ERROR",
              "Item RAP tidak sesuai proyek/material.",
            );
          const received = await tx.query.stockMovement.findMany({
            where: and(
              eq(stockMovement.projectRapItemId, rapItem.id),
              inArray(stockMovement.movementType, ["GOODS_RECEIPT", "GOODS_RECEIPT_REVERSAL"]),
            ),
            orderBy: [asc(stockMovement.id)],
          });
          const receivedQuantity = received.reduce(
            (sum, r) =>
              sum + (r.movementType === "GOODS_RECEIPT_REVERSAL" ? -1 : 1) * Number(r.quantity),
            0,
          );
          if (receivedQuantity + item.quantity > Number(rapItem.totalQuantity) + 0.001)
            throw new WarehouseIntakeError(
              "VALIDATION_ERROR",
              "Penerimaan melebihi sisa kebutuhan RAP.",
            );
          snapshot.push(rap, rapItem, received);
          rapNames.set(rapItem.id, rapItem.name);
        }
      }
    }
    const receivingKey = (item: { materialId: string; projectRapItemId?: string }): string =>
      `${item.materialId}:${item.projectRapItemId ?? "manual"}`;
    const finalStock = new Map<string, { quantity: number; average: number }>();
    for (const item of input.items.toSorted(
      (a, b) =>
        a.materialId.localeCompare(b.materialId) ||
        ("projectRapItemId" in a && typeof a.projectRapItemId === "string"
          ? a.projectRapItemId
          : ""
        ).localeCompare(
          "projectRapItemId" in b && typeof b.projectRapItemId === "string"
            ? b.projectRapItemId
            : "",
        ),
    )) {
      const source = sources.get(item.materialId);
      if (!source) throw new WarehouseIntakeError("NOT_FOUND", "Sumber inventory tidak tersedia.");
      const current = finalStock.get(item.materialId) ?? {
        quantity: Number(source.inventory?.currentStock ?? 0),
        average: Number(source.inventory?.averageCost ?? 0),
      };
      finalStock.set(item.materialId, {
        quantity: stockQuantitySchema.parse(Number((current.quantity + item.quantity).toFixed(2))),
        average: Number(
          calculateTransferDestinationAverage({
            destinationQuantity: current.quantity,
            destinationAverageCost: current.average,
            transferQuantity: item.quantity,
            sourceAverageCost: item.unitCost,
          }).toFixed(2),
        ),
      });
    }
    for (const item of input.items) {
      const source = sources.get(item.materialId),
        final = finalStock.get(item.materialId);
      if (!source || !final)
        throw new WarehouseIntakeError("NOT_FOUND", "Sumber inventory tidak tersedia.");
      const before = Number(source.inventory?.currentStock ?? 0),
        after = final.quantity,
        avg = final.average;
      const rapId =
        "projectRapItemId" in item && typeof item.projectRapItemId === "string"
          ? item.projectRapItemId
          : undefined;
      rows.push({
        id: `${source.inventory?.id ?? `${source.material.id}:${source.location.id}`}:${receivingKey(item)}`,
        title: source.material.name,
        meta: `${item.quantity.toLocaleString("id-ID")} ${source.material.unit} · ${rapId ? `${rapNames.get(rapId) ?? "RAP"} · ` : ""}${source.location.name}`,
        amount: Number((item.quantity * item.unitCost).toFixed(2)),
        comparisons: [
          { label: "Stok fisik", before, after, money: false },
          {
            label: "Biaya rata-rata",
            before: Number(source.inventory?.averageCost ?? 0),
            after: avg,
            money: true,
          },
        ],
        details: [
          ...(rapId ? [fact("Item RAP", rapNames.get(rapId) ?? "—")] : []),
          fact(
            "Jumlah diterima",
            `${item.quantity.toLocaleString("id-ID")} ${source.material.unit}`,
          ),
          fact("Harga pokok / satuan", item.unitCost, true),
          fact(
            "Reservasi tetap",
            `${Number(source.inventory?.reservedStock ?? 0).toLocaleString("id-ID")} ${source.material.unit}`,
          ),
          fact("Sumber penerimaan", input.note),
        ],
      });
    }
    summary.push(
      fact("Referensi", reference),
      fact(
        "Tanggal penerimaan",
        new Date(input.receivedAt + "T00:00:00Z").toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
      ),
      fact("Material diterima", sources.size),
      fact(
        "Nilai persediaan masuk",
        invoiceMoneySchema.parse(
          Number(rows.reduce((sum, r) => sum + (r.amount ?? 0), 0).toFixed(2)),
        ),
        true,
      ),
    );
    const newInventories = [...sources.values()].filter((source) => !source.inventory).length;
    if (newInventories) summary.push(fact("Inventory baru saat konfirmasi", newInventories));
    effect =
      "Menambah stok fisik dan memperbarui biaya rata-rata dengan jejak audit. Reservasi, realisasi budget proyek dan kas tetap; pembayaran dicatat terpisah.";
  } else {
    const request = input.action === "OPENING_REQUEST";
    let header: typeof inventoryOpeningBatch.$inferSelect | null = null;
    let requested: {
      materialInventoryId: string;
      quantity: number;
      unitCost: number;
      stockMovementId?: string | null;
    }[];
    if (request) {
      if (
        await tx.query.inventoryOpeningBatch.findFirst({
          where: and(
            eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
            eq(inventoryOpeningBatch.batchNumber, input.batchNumber),
          ),
        })
      )
        throw new WarehouseIntakeError("CONFLICT", "Referensi saldo awal sudah digunakan.");
      requested = input.items;
      entityName = input.batchNumber;
      meta = "Inventory perusahaan · pengajuan saldo awal";
      summary.push(
        fact("Referensi sumber", input.referenceNumber),
        fact("Tanggal saldo awal", input.cutoverDate),
        fact("Hasil", "Menunggu persetujuan pengguna lain"),
      );
    } else {
      const [h] = await tx
        .select()
        .from(inventoryOpeningBatch)
        .where(
          and(
            eq(inventoryOpeningBatch.id, input.batchId),
            eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("update");
      if (!h) throw new WarehouseIntakeError("NOT_FOUND", "Pengajuan saldo awal tidak ditemukan.");
      header = h;
      if (
        (input.action === "OPENING_REVERSE" && h.status !== "POSTED") ||
        (input.action !== "OPENING_REVERSE" && h.status !== "PENDING_APPROVAL")
      )
        throw new WarehouseIntakeError(
          "CONFLICT",
          "Status saldo awal sudah berubah. Minta preview terbaru.",
        );
      if (input.action === "OPENING_APPROVE" && h.requestedById === actor.userId)
        throw new WarehouseIntakeError(
          "FORBIDDEN",
          "Pembuat pengajuan harus memakai pemeriksa lain untuk menyetujui saldo awal.",
        );
      const items = await tx.query.inventoryOpeningItem.findMany({
        where: and(
          eq(inventoryOpeningItem.batchId, h.id),
          eq(inventoryOpeningItem.tenantId, INSTANCE_TENANT_ID),
        ),
        orderBy: [asc(inventoryOpeningItem.materialInventoryId)],
      });
      if (!items.length || items.length > 100)
        throw new WarehouseIntakeError(
          "VALIDATION_ERROR",
          "Review saldo awal mendukung 1–100 material; tinjau batch besar melalui modul saldo awal.",
        );
      requested = items.map((i) => ({
        materialInventoryId: i.materialInventoryId,
        quantity: Number(i.quantity),
        unitCost: Number(i.unitCost),
        stockMovementId: i.stockMovementId,
      }));
      snapshot.push(h, items);
      entityName = h.batchNumber;
      meta = `Inventory perusahaan · ${formatBusinessLabel(h.status)}`;
      summary.push(
        fact("Status sebelumnya", formatBusinessLabel(h.status)),
        fact(
          "Hasil",
          input.action === "OPENING_APPROVE"
            ? "Saldo awal diposting"
            : input.action === "OPENING_REJECT"
              ? "Pengajuan ditolak"
              : "Saldo awal dibalik",
        ),
        fact("Alasan", input.reason),
      );
    }
    const sources = new Map<string, InventorySource>();
    for (const item of requested.toSorted((a, b) =>
      a.materialInventoryId.localeCompare(b.materialInventoryId),
    )) {
      const source = await sourceInventory(tx, item.materialInventoryId),
        movements = await history(tx, source);
      snapshot.push(source, movements);
      sources.set(item.materialInventoryId, source);
      if (input.action === "OPENING_REQUEST" || input.action === "OPENING_APPROVE") {
        requireActive(source);
        if (
          Number(source.inventory.currentStock) !== 0 ||
          Number(source.inventory.reservedStock) !== 0 ||
          movements.length
        )
          throw new WarehouseIntakeError(
            "CONFLICT",
            "Saldo awal hanya untuk inventory kosong yang belum memiliki pergerakan.",
          );
      }
      if (request) {
        const pending = await tx
          .select({ id: inventoryOpeningItem.id })
          .from(inventoryOpeningItem)
          .innerJoin(
            inventoryOpeningBatch,
            eq(inventoryOpeningBatch.id, inventoryOpeningItem.batchId),
          )
          .where(
            and(
              eq(inventoryOpeningItem.materialInventoryId, source.inventory.id),
              eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
            ),
          )
          .limit(1);
        if (pending.length)
          throw new WarehouseIntakeError(
            "CONFLICT",
            "Inventory sudah diajukan dalam saldo awal yang menunggu persetujuan.",
          );
      }
      if (input.action === "OPENING_REVERSE") {
        const original = movements.find((m) => m.id === item.stockMovementId);
        if (
          !original ||
          movements.some((m) => m.id !== original.id && m.createdAt > original.createdAt) ||
          Number(source.inventory.currentStock) !== item.quantity ||
          Number(source.inventory.reservedStock) !== 0
        )
          throw new WarehouseIntakeError(
            "CONFLICT",
            "Saldo awal tidak dapat dibalik setelah stok berubah atau ada pergerakan berikutnya.",
          );
      }
    }
    for (const item of requested) {
      const source = sources.get(item.materialInventoryId);
      if (!source)
        throw new WarehouseIntakeError("NOT_FOUND", "Inventory saldo awal tidak ditemukan.");
      const before = Number(source.inventory.currentStock),
        after =
          input.action === "OPENING_REVERSE"
            ? 0
            : input.action === "OPENING_REJECT"
              ? before
              : item.quantity;
      rows.push({
        id: source.inventory.id,
        title: source.material.name,
        meta: `${item.quantity.toLocaleString("id-ID")} ${source.material.unit} · ${source.location.name}`,
        amount: Number((item.quantity * item.unitCost).toFixed(2)),
        comparisons: [
          {
            label: request ? "Stok setelah persetujuan" : "Stok fisik",
            before,
            after,
            money: false,
          },
        ],
        details: [
          fact("Harga pokok / satuan", item.unitCost, true),
          fact("Lokasi", source.location.name),
          fact("Catatan sumber", request ? input.note : (header?.note ?? "—")),
        ],
      });
    }
    title = request
      ? "Pengajuan saldo awal stok"
      : input.action === "OPENING_APPROVE"
        ? "Persetujuan saldo awal stok"
        : input.action === "OPENING_REJECT"
          ? "Penolakan saldo awal stok"
          : "Pembatalan saldo awal stok";
    summary.push(
      fact("Material", rows.length),
      fact(
        "Nilai saldo awal",
        invoiceMoneySchema.parse(
          Number(rows.reduce((sum, r) => sum + (r.amount ?? 0), 0).toFixed(2)),
        ),
        true,
      ),
    );
    effect = request
      ? "Mengajukan saldo awal kepada pemeriksa lain. Stok belum berubah; kas dan budget proyek tetap."
      : input.action === "OPENING_APPROVE"
        ? "Memposting stok dan harga pokok awal dengan jejak audit. Kas dan budget proyek tetap."
        : input.action === "OPENING_REJECT"
          ? "Menolak pengajuan dengan alasan. Stok, kas dan budget proyek tetap."
          : "Membalik seluruh saldo awal yang belum dipakai, dengan pergerakan keluar dan audit. Kas dan budget proyek tetap.";
  }
  return procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: input.action,
    input,
    title,
    entityName,
    meta,
    projectId,
    contextHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    effect,
    rows,
    summary,
    budget,
  });
}
