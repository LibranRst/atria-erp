import { createHash } from "node:crypto";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  prepareReceiptReversalTx,
  type ReceiptReversalTx,
} from "../material/receipt-reversal-writer";
import {
  procurementWarehouseProposalSchema,
  type ReceiptReversalInput,
  type ProcurementWarehouseProposal,
} from "@atria/core/ai/procurement-warehouse";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
export async function prepareReceiptReversalProposalTx(
  tx: ReceiptReversalTx,
  actor: Actor,
  input: ReceiptReversalInput,
): Promise<ProcurementWarehouseProposal> {
  const prepared = await prepareReceiptReversalTx(tx, actor, input),
    { receipt, location, rows } = prepared;
  const approval = input.action === "RECEIPT_REVERSAL_APPROVE";
  const titles = {
    RECEIPT_REVERSAL_REQUEST: "Pembatalan penerimaan",
    RECEIPT_REVERSAL_APPROVE: "Persetujuan pembatalan penerimaan",
    RECEIPT_REVERSAL_REJECT: "Penolakan pembatalan penerimaan",
  };
  const fact = (
    label: string,
    value: string | number,
    money = false,
  ): ProcurementWarehouseProposal["summary"][number] => ({ label, value, money });
  const budget = actorCan(actor, "view:budget")
    ? await tx.query.projectBudgets.findFirst({
        where: (t, { eq }) => eq(t.projectId, receipt.projectId),
        with: { categories: { with: { expenseCategory: true } } },
      })
    : null;
  const material = budget?.categories.find((c) => c.expenseCategory.code === "MATERIAL");
  return procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: input.action,
    input,
    title: titles[input.action],
    entityName: prepared.project.name,
    meta: `${receipt.receiptNumber} · ${location.name}`,
    projectId: receipt.projectId,
    contextHash: createHash("sha256").update(JSON.stringify({ prepared, budget })).digest("hex"),
    effect: approval
      ? "Membatalkan seluruh penerimaan dengan pergerakan stok keluar dan audit, lalu memperbarui biaya rata-rata. Reservasi, realisasi Material, tagihan vendor dan kas tetap."
      : input.action === "RECEIPT_REVERSAL_REQUEST"
        ? "Mengajukan pembatalan seluruh penerimaan untuk disetujui pengguna lain. Stok, biaya rata-rata, tagihan vendor, realisasi Material dan kas belum berubah."
        : "Menolak pengajuan pembatalan dengan alasan; penerimaan kembali berlaku. Stok, biaya rata-rata, tagihan vendor, realisasi Material dan kas tetap.",
    rows: rows.map((r) => ({
      id: r.item.id,
      title: r.material.name,
      meta: `${Number(r.item.quantity).toLocaleString("id-ID")} ${r.material.unit} · ${location.name}`,
      amount: Number((Number(r.item.quantity) * Number(r.item.unitCost)).toFixed(2)),
      comparisons: [
        {
          label: "Stok fisik",
          before: r.before.current,
          after: r.after.current,
          money: false,
        },
        {
          label: "Biaya rata-rata",
          before: r.before.averageCost,
          after: r.after.averageCost,
          money: true,
        },
      ],
      details: [
        fact("Jumlah penerimaan", Number(r.item.quantity)),
        fact("Satuan", r.material.unit),
        fact("Harga penerimaan per satuan", Number(r.item.unitCost), true),
        fact("Reservasi tetap", Number(r.inventory.reservedStock)),
        fact("Alasan", "reason" in input ? input.reason : (receipt.reversalReason ?? "—")),
      ],
    })),
    summary: [
      fact("Nomor penerimaan", receipt.receiptNumber),
      fact("Material", rows.length),
      fact(
        "Hasil",
        approval
          ? "Dibatalkan"
          : input.action === "RECEIPT_REVERSAL_REQUEST"
            ? "Menunggu persetujuan"
            : "Penerimaan tetap berlaku",
      ),
      fact("Status sebelumnya", formatBusinessLabel(receipt.status)),
    ],
    budget: material
      ? [
          fact("Alokasi Material", Number(material.allocatedAmount), true),
          fact("Realisasi Material tetap", Number(material.actualAmount), true),
          fact("Menunggu review", Number(material.pendingAmount), true),
        ]
      : null,
  });
}
