import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  dateValue,
  moneyValue,
  quantityValue,
  textValue,
  type ActivityDetailView,
} from "@atria/core/activity-detail/types";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  canLinkProject,
  enforceAssignedProject,
  fact,
  statusTone,
  total,
  type ActivityUser,
} from "./activity-detail-resolver-utils";
export async function resolveStockMovement(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.stockMovement.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      material: true,
      location: true,
      project: true,
      createdBy: true,
      vendorBill: true,
      projectCost: true,
    },
  });
  if (!row) return null;
  if (row.projectId) await enforceAssignedProject(row.projectId, user, roleName);
  const direction =
    row.movementDirection === "IN"
      ? "Masuk"
      : row.movementDirection === "OUT"
        ? "Keluar"
        : "Tidak mengubah stok fisik";
  const stockValue = Number(row.quantity) * Number(row.unitCost);
  return {
    kind: "STOCK_MOVEMENT",
    id: row.id,
    title: "Detail pergerakan stok",
    subtitle: row.material.name,
    status: row.movementType,
    statusTone: statusTone(row.movementType),
    occurredAt: row.createdAt.toISOString(),
    actorName: row.createdBy.name,
    facts: [
      fact("Material", textValue(row.material.name)),
      fact("Lokasi", textValue(row.location.name)),
      fact("Arah", textValue(direction)),
      fact("Jumlah", quantityValue(Number(row.quantity), row.material.unit)),
      fact("Harga satuan", moneyValue(Number(row.unitCost))),
      fact("Nilai pergerakan", moneyValue(stockValue)),
      ...(row.project ? [fact("Proyek", textValue(row.project.name))] : []),
    ],
    comparisons: [],
    impacts: [
      fact(
        "Dampak stok",
        textValue(
          direction === "Masuk"
            ? "Menambah stok lokasi"
            : direction === "Keluar"
              ? "Mengurangi stok lokasi"
              : "Tidak mengubah stok fisik",
        ),
      ),
      fact(
        "Dampak kas",
        textValue(
          row.projectCostId || row.vendorBillId
            ? "Dampak kas mengikuti transaksi finansial sumber"
            : "Kas tidak berubah langsung",
        ),
      ),
    ],
    notes: [
      fact("Catatan", textValue(row.note?.trim() || "Tidak ada catatan")),
      ...(row.referenceType
        ? [fact("Referensi", textValue(formatBusinessLabel(row.referenceType)))]
        : []),
    ],
    source:
      row.project && canLinkProject(roleName)
        ? { label: "Lihat proyek", href: `/projects/${row.project.id}?tab=stok` }
        : row.vendorBill
          ? { label: "Buka tagihan", href: "/expenses?tab=vendor-bills" }
          : null,
    evidenceIncomplete: false,
  };
}

export async function resolveGoodsReceipt(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.goodsReceipt.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      project: true,
      inventoryLocation: true,
      vendorBill: true,
      receivedBy: true,
      items: { with: { material: true } },
    },
  });
  if (!row) return null;
  await enforceAssignedProject(row.projectId, user, roleName);
  const receiptTotal = total(row.items);
  const inventoryRows =
    row.items.length > 0
      ? await db.query.materialInventory.findMany({
          where: (table, { and }) =>
            and(
              eq(table.locationId, row.inventoryLocationId),
              inArray(
                table.materialId,
                row.items.map((item) => item.materialId),
              ),
            ),
        })
      : [];
  const inventoryByMaterial = new Map(
    inventoryRows.map((inventory) => [inventory.materialId, inventory]),
  );
  const reversalRequested = row.status === "REVERSAL_REQUESTED";
  return {
    kind: "GOODS_RECEIPT",
    id: row.id,
    title: row.receiptNumber,
    subtitle: reversalRequested ? "Permintaan pembatalan penerimaan" : "Penerimaan barang",
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.receivedAt.toISOString(),
    actorName: row.receivedBy.name,
    facts: [
      fact("Proyek", textValue(row.project.name)),
      fact("Lokasi", textValue(row.inventoryLocation.name)),
      ...(row.vendorBill ? [fact("Tagihan vendor", textValue(row.vendorBill.billNumber))] : []),
      fact("Jumlah item", quantityValue(row.items.length, "item")),
      fact("Total penerimaan", moneyValue(receiptTotal)),
      ...(reversalRequested
        ? [
            fact(
              "Keputusan diperlukan",
              textValue("Setujui atau tolak permintaan pembatalan penerimaan"),
            ),
          ]
        : []),
      ...row.items.flatMap((item, index) => {
        const inventory = inventoryByMaterial.get(item.materialId);
        return [
          fact(
            `${index + 1}. ${item.material.name}`,
            quantityValue(Number(item.quantity), item.material.unit),
          ),
          fact(`Harga satuan ${index + 1}`, moneyValue(Number(item.unitCost))),
          fact(`Subtotal ${index + 1}`, moneyValue(Number(item.quantity) * Number(item.unitCost))),
          ...(inventory
            ? [
                fact(
                  `Stok fisik ${index + 1}`,
                  quantityValue(Number(inventory.currentStock), item.material.unit),
                ),
                fact(
                  `Stok direservasi ${index + 1}`,
                  quantityValue(Number(inventory.reservedStock), item.material.unit),
                ),
                fact(
                  `Stok tersedia ${index + 1}`,
                  quantityValue(
                    Math.max(0, Number(inventory.currentStock) - Number(inventory.reservedStock)),
                    item.material.unit,
                  ),
                ),
                fact(`Harga rata-rata ${index + 1}`, moneyValue(Number(inventory.averageCost))),
                fact(
                  `Nilai persediaan ${index + 1}`,
                  moneyValue(Number(inventory.currentStock) * Number(inventory.averageCost)),
                ),
              ]
            : []),
        ];
      }),
    ],
    comparisons: [],
    impacts: [
      fact(
        "Stok",
        textValue(
          row.status === "REVERSED"
            ? "Penerimaan telah dibalik dari stok"
            : reversalRequested
              ? "Jika disetujui, stok penerimaan akan dikurangi dari lokasi"
              : "Menambah stok lokasi dan memperbarui valuasi",
        ),
      ),
      fact("Kas", textValue("Tidak berubah oleh penerimaan barang")),
      fact("Realisasi biaya proyek", textValue("Tidak berubah oleh penerimaan barang")),
    ],
    notes: [
      fact("Catatan", textValue(row.note?.trim() || "Tidak ada catatan")),
      ...(row.reversalReason ? [fact("Alasan pembatalan", textValue(row.reversalReason))] : []),
    ],
    source: canLinkProject(roleName)
      ? { label: "Lihat proyek", href: `/projects/${row.projectId}?tab=stok` }
      : { label: "Buka material", href: "/materials?tab=activity" },
    evidenceIncomplete: false,
  };
}

export async function resolveStockTransfer(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.stockTransfer.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      fromLocation: true,
      toLocation: true,
      createdBy: true,
      items: { with: { material: true } },
    },
  });
  if (!row) return null;
  const transferTotal = total(row.items);
  return {
    kind: "STOCK_TRANSFER",
    id: row.id,
    title: row.transferNumber,
    subtitle: "Transfer antar lokasi",
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.transferredAt.toISOString(),
    actorName: row.createdBy.name,
    facts: [
      fact("Dari", textValue(row.fromLocation.name)),
      fact("Ke", textValue(row.toLocation.name)),
      fact("Jumlah item", quantityValue(row.items.length, "item")),
      fact("Total nilai", moneyValue(transferTotal)),
      ...row.items.flatMap((item, index) => [
        fact(
          `${index + 1}. ${item.material.name}`,
          quantityValue(Number(item.quantity), item.material.unit),
        ),
        fact(`Subtotal ${index + 1}`, moneyValue(Number(item.quantity) * Number(item.unitCost))),
      ]),
    ],
    comparisons: [],
    impacts: [
      fact("Lokasi asal", textValue("Stok berkurang")),
      fact("Lokasi tujuan", textValue("Stok bertambah")),
      fact("Total stok", textValue("Jumlah keseluruhan tidak berubah")),
      fact("Kas", textValue("Kas tidak berubah")),
    ],
    notes: [fact("Catatan", textValue(row.note))],
    source: { label: "Buka aktivitas material", href: "/materials?tab=activity" },
    evidenceIncomplete: false,
  };
}

export async function resolveStockCount(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.stockCount.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      location: true,
      createdBy: true,
      approvedBy: true,
      items: { with: { material: true } },
    },
  });
  if (!row) return null;
  const varianceValue = row.items.reduce(
    (sum, item) => sum + Number(item.varianceQuantity) * Number(item.unitCost),
    0,
  );
  const approvalPending = row.status === "PENDING_APPROVAL";
  return {
    kind: "STOCK_COUNT",
    id: row.id,
    title: row.countNumber,
    subtitle: approvalPending ? "Stock opname menunggu persetujuan" : "Stock opname",
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.countedAt.toISOString(),
    actorName: row.createdBy.name,
    facts: [
      fact("Lokasi", textValue(row.location.name)),
      fact("Jumlah item", quantityValue(row.items.length, "item")),
      ...(approvalPending
        ? [
            fact(
              "Keputusan diperlukan",
              textValue("Setujui penyesuaian stok atau tolak hasil stock opname"),
            ),
          ]
        : []),
      ...(row.approvedBy ? [fact("Pemeriksa", textValue(row.approvedBy.name))] : []),
    ],
    comparisons: row.items.map((item) => ({
      label: item.material.name,
      before: quantityValue(Number(item.systemQuantity), item.material.unit),
      after: quantityValue(Number(item.countedQuantity), item.material.unit),
    })),
    impacts: [
      fact(
        "Selisih jumlah",
        quantityValue(row.items.reduce((sum, item) => sum + Number(item.varianceQuantity), 0)),
      ),
      fact("Nilai selisih", moneyValue(varianceValue)),
      ...(approvalPending
        ? [fact("Jika disetujui", textValue("Stok lokasi disesuaikan dengan hasil hitung fisik"))]
        : []),
      fact("Kas", textValue("Kas tidak berubah")),
    ],
    notes: [
      fact("Catatan", textValue(row.note?.trim() || "Tidak ada catatan")),
      ...(row.rejectionReason ? [fact("Alasan keputusan", textValue(row.rejectionReason))] : []),
    ],
    source: { label: "Buka aktivitas material", href: "/materials?tab=activity" },
    evidenceIncomplete: row.status === "REJECTED" && !row.rejectionReason,
  };
}

export async function resolveOpening(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.inventoryOpeningBatch.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      requestedBy: true,
      approvedBy: true,
      reversedBy: true,
      items: {
        with: { inventory: { with: { material: true, location: true } }, stockMovement: true },
      },
    },
  });
  if (!row) return null;
  const openingTotal = total(row.items);
  const reason = row.decisionReason ?? row.rejectedReason ?? null;
  return {
    kind: "INVENTORY_OPENING",
    id: row.id,
    title: row.batchNumber,
    subtitle: "Saldo awal stok",
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt:
      row.postedAt?.toISOString() ?? row.approvedAt?.toISOString() ?? row.createdAt.toISOString(),
    actorName: row.requestedBy.name,
    facts: [
      fact("Tanggal saldo awal", dateValue(row.cutoverDate)),
      fact("Pengaju", textValue(row.requestedBy.name)),
      ...(row.approvedBy ? [fact("Pemeriksa", textValue(row.approvedBy.name))] : []),
      fact("Jumlah item", quantityValue(row.items.length, "item")),
      fact("Total batch", moneyValue(openingTotal)),
      ...row.items.flatMap((item, index) => [
        fact(
          `${index + 1}. ${item.inventory.material.name}`,
          quantityValue(Number(item.quantity), item.inventory.material.unit),
        ),
        fact(`Lokasi ${index + 1}`, textValue(item.inventory.location.name)),
        fact(`Biaya satuan ${index + 1}`, moneyValue(Number(item.unitCost))),
        fact(`Subtotal ${index + 1}`, moneyValue(Number(item.quantity) * Number(item.unitCost))),
        ...(row.status === "POSTED" || row.status === "REVERSED"
          ? [
              fact(
                `Stok fisik ${index + 1}`,
                quantityValue(Number(item.inventory.currentStock), item.inventory.material.unit),
              ),
              fact(
                `Stok direservasi ${index + 1}`,
                quantityValue(Number(item.inventory.reservedStock), item.inventory.material.unit),
              ),
              fact(
                `Stok tersedia ${index + 1}`,
                quantityValue(
                  Math.max(
                    0,
                    Number(item.inventory.currentStock) - Number(item.inventory.reservedStock),
                  ),
                  item.inventory.material.unit,
                ),
              ),
              fact(`Harga rata-rata ${index + 1}`, moneyValue(Number(item.inventory.averageCost))),
              fact(
                `Nilai inventori ${index + 1}`,
                moneyValue(
                  Number(item.inventory.currentStock) * Number(item.inventory.averageCost),
                ),
              ),
            ]
          : []),
        ...(item.stockMovement
          ? [
              fact(
                `Pergerakan stok ${index + 1}`,
                textValue(formatBusinessLabel(item.stockMovement.movementType, "INVENTORY")),
              ),
            ]
          : []),
      ]),
    ],
    comparisons: [],
    impacts: [
      fact(
        "Stok",
        textValue(
          row.status === "POSTED"
            ? "Menambah stok fisik dan stok tersedia"
            : row.status === "REVERSED"
              ? "Saldo awal telah dibalik"
              : "Belum mengubah stok",
        ),
      ),
      fact("Nilai persediaan", moneyValue(row.status === "POSTED" ? openingTotal : 0)),
      fact("Kas", textValue("Tidak berubah")),
      fact("Utang vendor", textValue("Tidak berubah")),
      fact("Realisasi biaya proyek", textValue("Tidak berubah")),
    ],
    notes: [
      fact("Catatan", textValue(row.note)),
      ...(row.referenceNumber ? [fact("Dokumen sumber", textValue(row.referenceNumber))] : []),
      fact(
        "Alasan keputusan",
        textValue(reason ?? "Alasan keputusan belum tercatat pada data lama"),
      ),
      ...(row.reversalReason ? [fact("Alasan pembatalan", textValue(row.reversalReason))] : []),
    ],
    source: { label: "Buka saldo awal", href: "/materials/opening" },
    evidenceIncomplete: ["POSTED", "REJECTED"].includes(row.status) && !reason,
  };
}
