import { createHash } from "node:crypto";
import { db } from "@backend/db";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  procurementWarehouseProposalSchema,
  type ProcurementWarehouseProposal,
  type VendorBillCorrectionInput,
} from "@atria/core/ai/procurement-warehouse";
import {
  prepareVendorBillCorrectionTx,
  readVendorBillCorrectionSourceTx,
} from "../finance/vendor-bill-correction-writer";
import type { FinanceTransaction } from "../finance/mutation-access";
export async function readVendorBillCorrectionSource(
  actor: Actor,
  billId: string,
): Promise<Awaited<ReturnType<typeof readVendorBillCorrectionSourceTx>>> {
  return db.transaction((tx) => readVendorBillCorrectionSourceTx(tx, actor, billId));
}

export async function prepareVendorBillCorrectionProposalTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: VendorBillCorrectionInput,
): Promise<ProcurementWarehouseProposal> {
  const { source, after, amountChanged } = await prepareVendorBillCorrectionTx(tx, actor, input);
  type Fact = ProcurementWarehouseProposal["summary"][number];
  const fact = (label: string, value: string | number, money = false): Fact => ({
    label,
    value,
    money,
  });
  const date = (value: Date): string =>
    value.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const rows: ProcurementWarehouseProposal["rows"] = [];
  if (amountChanged)
    rows.push({
      id: "amount",
      title: "Nominal tagihan",
      meta: source.category.expenseCategory.name,
      amount: Number(after.amount),
      comparisons: [
        {
          label: "Nominal",
          before: Number(source.bill.amount),
          after: Number(after.amount),
          money: true,
        },
      ],
      details: [],
    });
  for (const [key, label, before, next] of [
    ["billNumber", "Nomor tagihan", source.bill.billNumber, after.billNumber],
    ["dueDate", "Jatuh tempo", date(source.bill.dueDate), date(after.dueDate)],
    ["notes", "Catatan tagihan", source.bill.notes ?? "—", after.notes ?? "—"],
  ])
    if (before !== next)
      rows.push({
        id: key,
        title: label,
        meta: "Koreksi dokumen",
        amount: null,
        comparisons: [],
        details: [fact(`${label} · sebelumnya`, before), fact(`${label} · sesudah`, next)],
      });
  const material = source.category.expenseCategory.code === "MATERIAL";
  const delta = amountChanged ? Number(after.amount) - Number(source.bill.amount) : 0;
  const actualAfter = Number(source.category.actualAmount) + (material ? 0 : delta);
  const over =
    amountChanged && !material
      ? Math.max(
          0,
          actualAfter +
            Number(source.category.pendingAmount) -
            Number(source.category.allocatedAmount),
        )
      : 0;
  const summary = [
    ...(amountChanged ? [fact("Nominal sebelumnya", Number(source.bill.amount), true)] : []),
    fact("Nominal setelah koreksi", Number(after.amount), true),
    fact("Sudah dibayar", source.completed, true),
    fact("Sisa tagihan", Number((Number(after.amount) - source.completed).toFixed(2)), true),
    fact("Status", formatBusinessLabel(after.status)),
  ];
  if (source.movements.length) summary.push(fact("Nilai penerimaan bersih", source.received, true));
  if (actorCan(actor, "view:budget") && over > 0)
    summary.push(fact("Melebihi alokasi termasuk pending", Number(over.toFixed(2)), true));
  const budget = actorCan(actor, "view:budget")
    ? [
        fact("Kategori", source.category.expenseCategory.name),
        fact("Alokasi kategori", Number(source.category.allocatedAmount), true),
        fact("Realisasi sebelumnya", Number(source.category.actualAmount), true),
        fact("Realisasi setelah koreksi", Number(actualAfter.toFixed(2)), true),
        fact("Menunggu review", Number(source.category.pendingAmount), true),
        fact(
          "Dampak koreksi",
          material
            ? "Pembelian tetap persediaan; realisasi Material tidak berubah."
            : "Nominal pengeluaran sumber diperbarui; tidak membuat pembayaran baru.",
        ),
      ]
    : null;
  const snapshot = JSON.stringify({ source, after, input });
  return procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: input.action,
    input,
    title: "Koreksi tagihan vendor",
    entityName: source.project.name,
    meta: `${source.bill.billNumber} · ${source.supplier.name} · ${source.category.expenseCategory.name}`,
    effect: amountChanged
      ? material
        ? "Memperbarui nominal tagihan dan nilai pengeluaran sumber persediaan. Kas, stok dan realisasi Material tetap."
        : "Memperbarui nominal tagihan dan realisasi kategori dari pengeluaran sumber yang sama. Kas dan stok tetap."
      : "Memperbarui dokumen tagihan dengan alasan tercatat. Nominal, pembayaran, kas, stok dan realisasi budget tetap.",
    projectId: source.bill.projectId,
    contextHash: createHash("sha256").update(snapshot).digest("hex"),
    rows,
    summary,
    budget,
  });
}
