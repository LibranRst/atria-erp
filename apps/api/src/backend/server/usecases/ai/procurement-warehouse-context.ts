import { prepareReceiptReversalProposalTx } from "./receipt-reversal-context";
import { prepareVendorBillCorrectionProposalTx } from "./vendor-bill-correction-context";
import { prepareWarehouseIntakeProposalTx } from "./warehouse-intake-context";
import { warehouseIntakeInputSchema } from "@atria/core/ai/procurement-warehouse";
import { authorizedPrivateAttachment } from "../media/private-attachments";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  formDraft,
  vendor,
  vendorBill,
  projectBudgetCategory,
  projectCategoryPlanItem,
  materialMaster,
  inventoryLocation,
  materialInventory,
  stockTransfer,
  stockCount,
  stockCountItem,
  projectRapItem,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  lockFinanceProject,
  assertFinancePermission,
  type FinanceTransaction,
} from "../finance/mutation-access";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import {
  assertCategoryPlanItemLinkAllowed,
  resolveBudgetCategoryForExpense,
} from "@backend/lib/budget/budget-sync";
import { validateStockMovementLinksTx } from "@backend/lib/material/stock-movement-links";
import {
  validateInvoiceSourcesTx,
  VENDOR_BILL_FORM_TYPE,
} from "../finance/vendor-bill-draft-writer";
import {
  vendorBillDraftPayloadSchema,
  type VendorBillDraftPayload,
} from "@atria/core/validations/vendor-bill-draft";
import { calculateTransferDestinationAverage } from "@atria/core/material/stock-valuation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  billProposalPayloadSchema,
  procurementWarehouseInputSchema,
  procurementWarehouseProposalSchema,
  procurementWarehousePermission,
  type ProcurementWarehouseInput,
  type ProcurementWarehouseProposal,
} from "@atria/core/ai/procurement-warehouse";

import { prepareStockCorrectionProposalTx } from "./stock-correction-context";
export class ProcurementWarehouseError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertProcurementWarehouseRights(
  actor: Actor,
  input: ProcurementWarehouseInput,
): void {
  if (
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, procurementWarehousePermission(input.action))
  )
    throw new ProcurementWarehouseError("FORBIDDEN", "Izin untuk tindakan ini tidak tersedia.");
  if (input.action.startsWith("VENDOR_BILL")) {
    assertFinancePermission(actor, procurementWarehousePermission(input.action));
    if (input.action === "VENDOR_BILL_CORRECT" && !actorCan(actor, "view:vendor_bill"))
      throw new ProcurementWarehouseError("FORBIDDEN", "Akses baca tagihan diperlukan.");
  } else if (!actorCan(actor, "view:material") || !actorCan(actor, "view:inventory"))
    throw new ProcurementWarehouseError("FORBIDDEN", "Akses Material dan persediaan diperlukan.");
}
type Fact = ProcurementWarehouseProposal["summary"][number];
type Row = ProcurementWarehouseProposal["rows"][number];
const fact = (label: string, value: string | number, money = false): Fact => ({
  label,
  value,
  money,
});
const labels: Readonly<Record<ProcurementWarehouseInput["action"], string>> = {
  STOCK_CORRECT: "Koreksi stok",
  VENDOR_BILL_CORRECT: "Koreksi tagihan vendor",
  PROJECT_RECEIPT: "Penerimaan material proyek",
  WAREHOUSE_STOCK_IN: "Stok masuk gudang",
  OPENING_REQUEST: "Pengajuan saldo awal stok",
  OPENING_APPROVE: "Persetujuan saldo awal stok",
  OPENING_REJECT: "Penolakan saldo awal stok",
  OPENING_REVERSE: "Pembatalan saldo awal stok",
  VENDOR_BILL_SAVE: "Draft tagihan vendor",
  VENDOR_BILL_SUBMIT: "Pengajuan tagihan vendor",
  WAREHOUSE_TRANSFER: "Transfer stok",
  STOCK_COUNT_SAVE: "Draft stock opname",
  STOCK_COUNT_SUBMIT: "Pengajuan stock opname",
  STOCK_COUNT_APPROVE: "Persetujuan stock opname",
  STOCK_COUNT_REJECT: "Penolakan stock opname",
  RECEIPT_REVERSAL_REQUEST: "Pengajuan pembatalan penerimaan",
  RECEIPT_REVERSAL_APPROVE: "Persetujuan pembatalan penerimaan",
  RECEIPT_REVERSAL_REJECT: "Penolakan pembatalan penerimaan",
};
function completeBillPayload(
  payload: VendorBillDraftPayload,
): ReturnType<typeof billProposalPayloadSchema.parse> {
  return billProposalPayloadSchema.parse({
    vendorId: payload.vendorId,
    projectId: payload.projectId,
    projectBudgetCategoryId: payload.projectBudgetCategoryId,
    projectCategoryPlanItemId: payload.projectCategoryPlanItemId || null,
    materialId: payload.materialId ?? null,
    projectRapItemId: payload.projectRapItemId ?? null,
    billNumber: payload.billNumber,
    amount: payload.amount,
    dueDate: payload.dueDate,
    notes: payload.notes,
    invoice: payload.invoice,
  });
}
export function toBillDraftPayload(
  input: ReturnType<typeof billProposalPayloadSchema.parse>,
): VendorBillDraftPayload {
  return {
    ...input,
    projectBudgetItemId: "",
    projectCategoryPlanItemId: input.projectCategoryPlanItemId ?? "",
  };
}
async function prepareTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: ProcurementWarehouseInput,
): Promise<ProcurementWarehouseProposal> {
  assertProcurementWarehouseRights(actor, input);
  if (input.action === "STOCK_CORRECT") return prepareStockCorrectionProposalTx(tx, actor, input);
  if (input.action === "VENDOR_BILL_CORRECT")
    return prepareVendorBillCorrectionProposalTx(tx, actor, input);
  const intake = warehouseIntakeInputSchema.safeParse(input);
  if (intake.success) return prepareWarehouseIntakeProposalTx(tx, actor, intake.data);
  if (
    input.action === "RECEIPT_REVERSAL_REQUEST" ||
    input.action === "RECEIPT_REVERSAL_APPROVE" ||
    input.action === "RECEIPT_REVERSAL_REJECT"
  )
    return prepareReceiptReversalProposalTx(tx, actor, input);
  let entityName = "",
    meta = "",
    projectId: string | null = null,
    effect = "",
    rows: Row[] = [],
    summary: Fact[] = [],
    budget: Fact[] | null = null;
  const snapshot: unknown[] = [];
  if (input.action === "VENDOR_BILL_SAVE" || input.action === "VENDOR_BILL_SUBMIT") {
    const draftId = input.draftId;
    const [draft] = draftId
      ? await tx
          .select()
          .from(formDraft)
          .where(
            and(
              eq(formDraft.id, draftId),
              eq(formDraft.tenantId, INSTANCE_TENANT_ID),
              eq(formDraft.ownerUserId, actor.userId),
              eq(formDraft.formType, VENDOR_BILL_FORM_TYPE),
            ),
          )
          .for("update")
      : [];
    if (draftId && (!draft || draft.status !== "ACTIVE" || draft.expiresAt <= new Date()))
      throw new ProcurementWarehouseError(
        "CONFLICT",
        "Draft tagihan berubah atau kedaluwarsa. Buka draft terbaru.",
      );
    if (input.action === "VENDOR_BILL_SAVE" && draft && input.expectedRevision !== draft.revision)
      throw new ProcurementWarehouseError("CONFLICT", "Versi draft berubah. Baca draft terbaru.");
    const payload =
      input.action === "VENDOR_BILL_SAVE"
        ? input.payload
        : completeBillPayload(vendorBillDraftPayloadSchema.parse(draft?.payload));
    projectId = payload.projectId;
    const project = await lockFinanceProject(tx, actor, projectId);
    if (project.tenantId !== INSTANCE_TENANT_ID)
      throw new ProcurementWarehouseError("FORBIDDEN", "Proyek di luar akses Anda.");
    if (input.action === "VENDOR_BILL_SUBMIT") assertProjectStatusIsOperational(project.status);
    else if (!["DRAFT", "ACTIVE"].includes(project.status))
      throw new ProcurementWarehouseError(
        "FORBIDDEN",
        "Proyek tidak tersedia untuk draft tagihan.",
      );
    const [supplier] = await tx
      .select()
      .from(vendor)
      .where(and(eq(vendor.id, payload.vendorId), eq(vendor.tenantId, INSTANCE_TENANT_ID)))
      .for("update");
    if (!supplier || !supplier.isActive)
      throw new ProcurementWarehouseError(
        "NOT_FOUND",
        "Vendor aktif belum ditemukan. Pilih vendor yang benar.",
      );
    const [category] = await tx
      .select()
      .from(projectBudgetCategory)
      .where(
        and(
          eq(projectBudgetCategory.id, payload.projectBudgetCategoryId),
          eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    const categoryContext = await tx.query.projectBudgetCategory.findFirst({
      where: eq(projectBudgetCategory.id, payload.projectBudgetCategoryId),
      with: { budget: true, expenseCategory: true },
    });
    if (!category || !categoryContext || categoryContext.budget.projectId !== projectId)
      throw new ProcurementWarehouseError(
        "VALIDATION_ERROR",
        "Kategori budget tidak sesuai proyek.",
      );
    await assertCategoryPlanItemLinkAllowed({
      tx,
      projectId,
      projectBudgetCategoryId: category.id,
      categoryCode: (
        await resolveBudgetCategoryForExpense({
          tx,
          projectId,
          projectBudgetCategoryId: category.id,
        })
      ).categoryCode,
      projectCategoryPlanItemId: payload.projectCategoryPlanItemId,
    });
    const packageItem = payload.projectCategoryPlanItemId
      ? await tx.query.projectCategoryPlanItem.findFirst({
          where: eq(projectCategoryPlanItem.id, payload.projectCategoryPlanItemId),
        })
      : null;
    const [material] = payload.materialId
      ? await tx
          .select()
          .from(materialMaster)
          .where(
            and(
              eq(materialMaster.id, payload.materialId),
              eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
            ),
          )
          .for("update")
      : [];
    if (
      payload.materialId &&
      (!material || !material.isActive || categoryContext.expenseCategory.code !== "MATERIAL")
    )
      throw new ProcurementWarehouseError(
        "VALIDATION_ERROR",
        "Tautan material hanya untuk kategori Material dan material aktif.",
      );
    await validateStockMovementLinksTx(tx, {
      projectId,
      materialId: payload.materialId,
      projectRapItemId: payload.projectRapItemId,
    });
    const rapItem = payload.projectRapItemId
      ? await tx.query.projectRapItem.findFirst({
          where: eq(projectRapItem.id, payload.projectRapItemId),
        })
      : null;
    await validateInvoiceSourcesTx(tx, actor, toBillDraftPayload(payload));
    const duplicate = await tx.query.vendorBill.findFirst({
      where: and(
        eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
        eq(vendorBill.billNumber, payload.billNumber),
      ),
    });
    if (duplicate)
      throw new ProcurementWarehouseError(
        "CONFLICT",
        "Nomor tagihan sudah terdaftar. Periksa invoice yang sama sebelum membuat tagihan.",
      );
    entityName = project.name;
    meta = `${supplier.name} · ${payload.billNumber}`;
    const materialPurchase = categoryContext.expenseCategory.code === "MATERIAL";
    effect =
      input.action === "VENDOR_BILL_SAVE"
        ? "Draft tersimpan untuk dikoreksi atau diajukan nanti. Belum ada tagihan, stok atau kas yang berubah."
        : materialPurchase
          ? "Membuat tagihan belum dibayar sebagai pembelian persediaan. Stok bertambah saat penerimaan; realisasi Material saat pemakaian. Kas tetap sampai pembayaran terpisah."
          : "Membuat tagihan belum dibayar dan realisasi kategori terkait. Pembayaran dan persetujuan pencairan tetap tindakan terpisah; kas belum berubah.";
    const sourceNames: string[] = [];
    for (const url of payload.invoice.urls) {
      const source = await authorizedPrivateAttachment(actor, url, "ai_chat", tx);
      sourceNames.push(source.fileName);
      snapshot.push({
        id: source.id,
        fileName: source.fileName,
        mimeType: source.mimeType,
        size: source.fileSize,
      });
    }
    const details = [
      fact("Vendor", supplier.name),
      fact("Kategori", categoryContext.expenseCategory.name),
      fact("Nomor tagihan", payload.billNumber),
      fact("Jatuh tempo", payload.dueDate),
      ...(packageItem ? [fact("Paket terkait", packageItem.name)] : []),
      ...(material ? [fact("Material terkait", material.name)] : []),
      ...(rapItem ? [fact("Item RAP", `${rapItem.name} · ${rapItem.area}`)] : []),
      ...(payload.notes ? [fact("Catatan", payload.notes)] : []),
      ...sourceNames.map((name, index) => fact(`Sumber invoice ${index + 1}`, name)),
    ];
    rows = payload.invoice.lines.length
      ? payload.invoice.lines.map((line, index) => ({
          id: `invoice-${index}`,
          title: line.name,
          meta: `${line.quantity.toLocaleString("id-ID")} ${line.unit} · ${line.source}`,
          amount: line.amount,
          comparisons: [],
          details: [],
        }))
      : [
          {
            id: "bill",
            title: payload.billNumber,
            meta: supplier.name,
            amount: payload.amount,
            comparisons: [],
            details,
          },
        ];
    if (payload.invoice.lines.length)
      rows.unshift({
        id: "bill",
        title: payload.billNumber,
        meta: "Identitas invoice",
        amount: null,
        comparisons: [],
        details,
      });
    summary = [
      fact("Nominal tagihan", payload.amount, true),
      fact("Kategori", categoryContext.expenseCategory.name),
      fact("Hasil", input.action === "VENDOR_BILL_SAVE" ? "Draft" : "Belum dibayar"),
    ];
    if (actorCan(actor, "view:budget")) {
      const after =
        Number(category.actualAmount) +
        (input.action === "VENDOR_BILL_SUBMIT" && !materialPurchase ? payload.amount : 0);
      budget = [
        fact("Alokasi kategori", Number(category.allocatedAmount), true),
        fact("Realisasi saat ini", Number(category.actualAmount), true),
        fact("Realisasi setelah tindakan", after, true),
        fact("Menunggu review", Number(category.pendingAmount), true),
        fact(
          "Sisa termasuk pending",
          Number(category.allocatedAmount) - after - Number(category.pendingAmount),
          true,
        ),
      ];
      if (after + Number(category.pendingAmount) > Number(category.allocatedAmount))
        summary.push(
          fact(
            "Melebihi alokasi termasuk pending",
            after + Number(category.pendingAmount) - Number(category.allocatedAmount),
            true,
          ),
        );
    }
    snapshot.push(
      project,
      { id: supplier.id, name: supplier.name, isActive: supplier.isActive },
      categoryContext,
      draft ?? null,
      packageItem,
      material ?? null,
      rapItem,
    );
  } else {
    const countId = "stockCountId" in input ? input.stockCountId : undefined;
    if (input.action === "STOCK_COUNT_SAVE") {
      const duplicate = await tx.query.stockCount.findFirst({
        where: and(
          eq(stockCount.countNumber, input.countNumber),
          eq(stockCount.tenantId, INSTANCE_TENANT_ID),
        ),
        columns: { id: true },
      });
      if (duplicate && duplicate.id !== input.stockCountId)
        throw new ProcurementWarehouseError(
          "CONFLICT",
          "Nomor stock opname sudah dipakai. Pilih nomor baru atau koreksi draft yang sama.",
        );
    }
    const [header] = countId
      ? await tx
          .select()
          .from(stockCount)
          .where(and(eq(stockCount.id, countId), eq(stockCount.tenantId, INSTANCE_TENANT_ID)))
          .for("update")
      : [];
    if (countId && !header)
      throw new ProcurementWarehouseError("NOT_FOUND", "Stock opname tidak ditemukan.");
    if ((input.action === "STOCK_COUNT_SAVE" && header) || input.action === "STOCK_COUNT_SUBMIT") {
      if (!header || header.status !== "DRAFT" || header.createdById !== actor.userId)
        throw new ProcurementWarehouseError(
          "FORBIDDEN",
          "Hanya pembuat dapat mengubah atau mengajukan Draft stock opname.",
        );
    }
    if (input.action === "STOCK_COUNT_APPROVE" || input.action === "STOCK_COUNT_REJECT") {
      if (!header || header.status !== "PENDING_APPROVAL")
        throw new ProcurementWarehouseError("CONFLICT", "Stock opname belum menunggu persetujuan.");
      if (input.action === "STOCK_COUNT_APPROVE" && header.createdById === actor.userId)
        throw new ProcurementWarehouseError(
          "FORBIDDEN",
          "Stock opname harus disetujui pengguna lain. Emergency override tetap melalui form gudang.",
        );
    }
    const savedItems = header
      ? await tx.query.stockCountItem.findMany({
          where: eq(stockCountItem.stockCountId, header.id),
          orderBy: [asc(stockCountItem.materialId), asc(stockCountItem.id)],
        })
      : [];
    if (savedItems.length > 100)
      throw new ProcurementWarehouseError(
        "VALIDATION_ERROR",
        "Review AI maksimal 100 material stock opname. Gunakan form gudang untuk dokumen ini.",
      );
    const materialIds =
      input.action === "WAREHOUSE_TRANSFER" || input.action === "STOCK_COUNT_SAVE"
        ? input.items.map((i) => i.materialId)
        : savedItems.map((i) => i.materialId);
    if (!materialIds.length)
      throw new ProcurementWarehouseError("VALIDATION_ERROR", "Pilih material yang dihitung.");
    const materials = await tx
      .select()
      .from(materialMaster)
      .where(
        and(
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          inArray(materialMaster.id, materialIds),
        ),
      )
      .orderBy(asc(materialMaster.id))
      .for("update");
    if (materials.length !== materialIds.length)
      throw new ProcurementWarehouseError("NOT_FOUND", "Material tidak tersedia.");
    const locationIds =
      input.action === "WAREHOUSE_TRANSFER"
        ? [input.fromLocationId, input.toLocationId]
        : [
            input.action === "STOCK_COUNT_SAVE"
              ? input.inventoryLocationId
              : header!.inventoryLocationId,
          ];
    const locations = await tx
      .select()
      .from(inventoryLocation)
      .where(
        and(
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
          inArray(inventoryLocation.id, locationIds),
        ),
      )
      .orderBy(asc(inventoryLocation.id))
      .for("update");
    if (locations.length !== locationIds.length || locations.some((l) => !l.isActive))
      throw new ProcurementWarehouseError("NOT_FOUND", "Lokasi aktif tidak tersedia.");
    const inventories = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
          inArray(materialInventory.materialId, materialIds),
          inArray(materialInventory.locationId, locationIds),
        ),
      )
      .orderBy(asc(materialInventory.materialId), asc(materialInventory.id))
      .for("update");
    if (inventories.length !== materialIds.length * locationIds.length)
      throw new ProcurementWarehouseError(
        "NOT_FOUND",
        "Inventory material belum tersedia di lokasi terkait.",
      );
    snapshot.push(header ?? null, savedItems, materials, locations, inventories);
    if (input.action === "WAREHOUSE_TRANSFER") {
      await assertOperationalStockReadiness(tx);
      if (materials.some((m) => !m.isActive))
        throw new ProcurementWarehouseError("VALIDATION_ERROR", "Transfer memakai material aktif.");
      const duplicate = await tx.query.stockTransfer.findFirst({
        where: and(
          eq(stockTransfer.tenantId, INSTANCE_TENANT_ID),
          eq(stockTransfer.transferNumber, input.transferNumber),
        ),
      });
      if (duplicate)
        throw new ProcurementWarehouseError("CONFLICT", "Nomor transfer sudah dipakai.");
      const sourceLocation = locations.find((l) => l.id === input.fromLocationId)!,
        destinationLocation = locations.find((l) => l.id === input.toLocationId)!;
      entityName = `${sourceLocation.name} → ${destinationLocation.name}`;
      meta = `${input.transferNumber} · ${input.transferredAt}`;
      let total = 0;
      rows = input.items.map((item) => {
        const material = materials.find((m) => m.id === item.materialId)!,
          source = inventories.find(
            (i) => i.materialId === item.materialId && i.locationId === sourceLocation.id,
          )!,
          destination = inventories.find(
            (i) => i.materialId === item.materialId && i.locationId === destinationLocation.id,
          )!;
        if (Number(source.currentStock) - item.quantity < Number(source.reservedStock))
          throw new ProcurementWarehouseError(
            "CONFLICT",
            "Transfer akan memakai stok yang sudah direservasi.",
          );
        const after = Number(destination.currentStock) + item.quantity;
        if (after > 9_999_999_999.99)
          throw new ProcurementWarehouseError("VALIDATION_ERROR", "Stok tujuan melewati batas.");
        const average = calculateTransferDestinationAverage({
          destinationQuantity: Number(destination.currentStock),
          destinationAverageCost: Number(destination.averageCost),
          transferQuantity: item.quantity,
          sourceAverageCost: Number(source.averageCost),
        });
        const amount = Number((item.quantity * Number(source.averageCost)).toFixed(2));
        total += amount;
        return {
          id: material.id,
          title: material.name,
          meta: `${item.quantity.toLocaleString("id-ID")} ${material.unit}`,
          amount,
          comparisons: [
            {
              label: `Stok fisik · ${sourceLocation.name}`,
              before: Number(source.currentStock),
              after: Number(source.currentStock) - item.quantity,
              money: false,
            },
            {
              label: `Stok fisik · ${destinationLocation.name}`,
              before: Number(destination.currentStock),
              after,
              money: false,
            },
          ],
          details: [
            fact("Satuan", material.unit),
            fact("Reservasi asal tetap", Number(source.reservedStock)),
            fact("Biaya rata-rata asal", Number(source.averageCost), true),
            fact("Biaya rata-rata tujuan setelah transfer", Number(average.toFixed(2)), true),
            fact("Alasan transfer", input.note),
          ],
        };
      });
      summary = [
        fact("Material dipindahkan", rows.length),
        fact("Nilai persediaan dipindahkan", Number(total.toFixed(2)), true),
      ];
      effect =
        "Memindahkan stok fisik yang tersedia antar lokasi dan memperbarui biaya rata-rata tujuan. Reservasi tetap; tidak membuat realisasi proyek atau transaksi kas.";
    } else {
      const location = locations[0];
      entityName = location.name;
      meta =
        input.action === "STOCK_COUNT_SAVE"
          ? `${input.countNumber} · ${input.countedAt}`
          : `${header!.countNumber} · ${formatBusinessLabel(header!.status)}`;
      const items =
        input.action === "STOCK_COUNT_SAVE"
          ? input.items
          : savedItems.map((i) => ({
              materialId: i.materialId,
              countedQuantity: Number(i.countedQuantity),
            }));
      let variances = 0;
      rows = items.map((item) => {
        const material = materials.find((m) => m.id === item.materialId)!,
          inventory = inventories.find((i) => i.materialId === item.materialId)!;
        const recorded = savedItems.find((i) => i.materialId === item.materialId);
        if (input.action === "STOCK_COUNT_APPROVE") {
          if (!recorded || Number(recorded.systemQuantity) !== Number(inventory.currentStock))
            throw new ProcurementWarehouseError(
              "CONFLICT",
              "Stok berubah sejak dihitung. Lakukan stock opname ulang.",
            );
          if (item.countedQuantity < Number(inventory.reservedStock))
            throw new ProcurementWarehouseError(
              "CONFLICT",
              "Hasil hitung lebih kecil dari reservasi. Rekonsiliasi reservasi dahulu.",
            );
        }
        const system =
          input.action === "STOCK_COUNT_SAVE"
            ? Number(inventory.currentStock)
            : Number(recorded!.systemQuantity);
        if (system !== item.countedQuantity) variances += 1;
        return {
          id: material.id,
          title: material.name,
          meta: `${material.unit} · ${location.name}`,
          amount: null,
          comparisons: [
            {
              label:
                input.action === "STOCK_COUNT_APPROVE"
                  ? "Stok fisik setelah persetujuan"
                  : "Stok sistem → hasil hitung",
              before: system,
              after: item.countedQuantity,
              money: false,
            },
          ],
          details: [
            fact("Stok fisik saat ini", Number(inventory.currentStock)),
            fact("Reservasi saat ini", Number(inventory.reservedStock)),
            fact("Selisih hasil hitung", Number((item.countedQuantity - system).toFixed(2))),
            fact(
              "Alasan",
              input.action === "STOCK_COUNT_SAVE"
                ? input.note
                : input.action === "STOCK_COUNT_REJECT"
                  ? input.reason
                  : (header!.note ?? "—"),
            ),
          ],
        };
      });
      summary = [
        fact("Material dihitung", rows.length),
        fact("Material berselisih", variances),
        fact(
          "Hasil tindakan",
          input.action === "STOCK_COUNT_SAVE"
            ? "Draft"
            : input.action === "STOCK_COUNT_SUBMIT"
              ? "Menunggu persetujuan"
              : input.action === "STOCK_COUNT_APPROVE"
                ? "Koreksi diterapkan"
                : "Ditolak",
        ),
      ];
      effect =
        input.action === "STOCK_COUNT_APPROVE"
          ? "Menerapkan hasil hitung sebagai stok fisik, dengan pergerakan koreksi dan audit. Reservasi, biaya rata-rata, realisasi proyek dan kas tetap."
          : input.action === "STOCK_COUNT_REJECT"
            ? "Menolak hasil hitung dengan alasan. Stok, realisasi dan kas tetap."
            : input.action === "STOCK_COUNT_SAVE"
              ? "Menyimpan hasil hitung sebagai Draft. Stok, realisasi dan kas tetap; ajukan kepada pemeriksa saat siap."
              : "Mengajukan hasil hitung kepada pengguna lain untuk disetujui. Stok belum dikoreksi; realisasi dan kas tetap.";
      if (input.action === "STOCK_COUNT_APPROVE") await assertOperationalStockReadiness(tx);
    }
  }
  return procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: input.action,
    input,
    title: labels[input.action],
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
export async function prepareProcurementWarehouseProposal(
  actor: Actor,
  raw: unknown,
  tx?: FinanceTransaction,
): Promise<ProcurementWarehouseProposal> {
  const input = procurementWarehouseInputSchema.parse(raw);
  return tx
    ? prepareTx(tx, actor, input)
    : db.transaction((connection) => prepareTx(connection, actor, input));
}
