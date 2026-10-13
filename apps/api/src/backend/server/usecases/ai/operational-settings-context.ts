import { createHash } from "node:crypto";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { db } from "@backend/db";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  readOperationalThresholds,
  validateExpenseCategoryPatch,
  OperationalSettingsError,
} from "../settings/operational-settings-writer";
import {
  financeInputProposalSchema,
  type FinanceInputProposal,
} from "@atria/core/ai/finance-input";
import {
  isCoreExpenseCode,
  type OperationalSettingsInput,
} from "@atria/core/ai/operational-settings";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

type Reader = Pick<FinanceTransaction, "query" | "select">;
type SettingsActor = Pick<Actor, "permissions" | "userId">;
const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const percent = (value: number): string =>
  `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: 4 })}%`;
export async function prepareOperationalSettingsInput(
  actor: SettingsActor,
  input: OperationalSettingsInput,
  reader: Reader = db,
): Promise<FinanceInputProposal> {
  if (!actorCan(actor, "use:ai_chat"))
    throw new OperationalSettingsError("FORBIDDEN", "Akses chat tidak tersedia.");
  if (input.action === "APPROVAL_THRESHOLDS") {
    const current = await readOperationalThresholds(actor, reader);
    const next = {
      fieldCostCents:
        input.patch.fieldCostAmount === undefined
          ? current.values.fieldCostCents
          : Math.round(input.patch.fieldCostAmount * 100),
      vendorPaymentCents:
        input.patch.vendorPaymentAmount === undefined
          ? current.values.vendorPaymentCents
          : Math.round(input.patch.vendorPaymentAmount * 100),
    };
    const changes: FinanceInputProposal["changes"] = [];
    for (const [key, label] of [
      ["fieldCostCents", "Pengeluaran lapangan"],
      ["vendorPaymentCents", "Pembayaran vendor"],
    ] as const) {
      if (current.values[key] !== next[key])
        changes.push({
          label,
          before: current.values[key] / 100,
          after: next[key] / 100,
          money: true,
        });
    }
    if (!changes.length)
      throw new OperationalSettingsError(
        "VALIDATION_ERROR",
        "Ambang sudah sesuai; tidak ada perubahan untuk disimpan.",
      );
    return financeInputProposalSchema.parse({
      kind: "FINANCE_INPUT",
      input,
      title: "Ambang persetujuan",
      entityName: "Pengaturan perusahaan",
      projectId: null,
      expectedContext: hash(current),
      effect:
        "Berlaku untuk pengajuan berikutnya. Pengajuan yang sudah berjalan tetap memakai keputusan awal; aturan di luar budget tetap berlaku.",
      summary: [
        {
          label: "Pengeluaran lapangan setelah perubahan",
          value: next.fieldCostCents / 100,
          money: true,
        },
        {
          label: "Pembayaran vendor setelah perubahan",
          value: next.vendorPaymentCents / 100,
          money: true,
        },
      ],
      changes,
      rows: [],
    });
  }
  const current = await validateExpenseCategoryPatch(
    actor,
    input.expenseCategoryId,
    input.patch,
    reader,
  );
  const changes: FinanceInputProposal["changes"] = [];
  const before = current.category;
  if (input.patch.name !== undefined && before.name !== input.patch.name)
    changes.push({ label: "Nama kategori", before: before.name, after: input.patch.name });
  if (
    input.patch.description !== undefined &&
    (before.description || "") !== (input.patch.description || "")
  )
    changes.push({
      label: "Deskripsi",
      before: before.description || "—",
      after: input.patch.description || "—",
    });
  if (input.patch.isActive !== undefined && before.isActive !== input.patch.isActive)
    changes.push({
      label: "Status pilihan",
      before: before.isActive ? "Aktif" : "Nonaktif",
      after: input.patch.isActive ? "Aktif" : "Nonaktif",
    });
  if (current.ratioChanged && input.patch.defaultRatio !== undefined) {
    const ratioBefore = current.allocation
      ? Number(current.allocation.ratioPercentage)
      : Number(before.defaultRatio);
    if (ratioBefore !== input.patch.defaultRatio)
      changes.push({
        label: current.allocation ? "Alokasi default" : "Rasio referensi kategori",
        before: percent(ratioBefore),
        after: percent(input.patch.defaultRatio),
      });
    if (Number(before.defaultRatio) !== ratioBefore)
      changes.push({
        label: "Rasio referensi kategori",
        before: percent(Number(before.defaultRatio)),
        after: percent(input.patch.defaultRatio),
      });
  }
  if (!changes.length)
    throw new OperationalSettingsError(
      "VALIDATION_ERROR",
      "Kategori sudah sesuai; tidak ada perubahan untuk disimpan.",
    );
  return financeInputProposalSchema.parse({
    kind: "FINANCE_INPUT",
    input,
    title: "Pengaturan kategori",
    entityName: before.name,
    projectId: null,
    expectedContext: hash(current),
    effect: current.ratioChanged
      ? current.allocation
        ? "Alokasi default dan referensi kategori diperbarui bersama untuk setup berikutnya. Budget dan nominal transaksi yang tersimpan tetap."
        : "Rasio referensi kategori diperbarui. Alokasi default aktif, budget dan nominal transaksi yang tersimpan tetap."
      : "Detail pilihan kategori diperbarui. Identitas kategori, alokasi dan nominal transaksi yang tersimpan tetap.",
    summary: [
      {
        label: "Kategori",
        value: isCoreExpenseCode(before.code) ? formatBusinessLabel(before.code) : before.name,
      },
      { label: "Perubahan", value: changes.length },
      {
        label: "Status pilihan setelah perubahan",
        value: (input.patch.isActive ?? before.isActive) ? "Aktif" : "Nonaktif",
      },
    ],
    changes,
    rows: [],
  });
}
