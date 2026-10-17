"use client";

import type { JSX, RefObject } from "react";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@atria/core/finance/budget-indicator";
import { formatShortDate } from "@atria/core/utils/date";
import { AppIcon, Button, FactRow, GroupedSurface, MoneyValue, StatusBadge } from "@/components/ui";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/shared/inventory-opening-approval-items";
import { approvalIsCritical } from "@/features/approvals/utils/approval-list-utils";
import {
  ApprovalEvidenceRow,
  cleanApprovalNotes,
  type ApprovalDecision,
  type ApprovalItem,
} from "./approval-list-presentation";

type ApprovalDesktopDetailProps = {
  readonly decisionReturnFocusRef?: RefObject<HTMLElement | null>;
  readonly item: ApprovalItem;
  readonly pending: boolean;
  readonly canDecide: boolean;
  readonly onBack: () => void;
  readonly onOpenReceipt: (url: string) => void;
  readonly onDecision: (item: ApprovalItem, status: ApprovalDecision["status"]) => void;
};

function ApprovalAmount({ amount }: { readonly amount: number }): JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      variant="fullDynamic"
      size="sm"
      align="right"
    />
  );
}

/** The same canonical impact calculation as mobile, with facts that fit a narrow aside. */
function ApprovalDesktopImpact({ item }: { readonly item: ApprovalItem }): JSX.Element {
  if (item.type === "inventory_opening") {
    return (
      <section aria-label="Dampak saldo awal stok" className="space-y-2">
        <h3 className="px-1 text-row font-bold text-on-surface">Dampak setelah disetujui</h3>
        <GroupedSurface variant="desktopPanel" className="divide-y divide-outline-variant/40">
          <p className="px-4 py-3 text-support text-on-surface">
            Menambah {item.budgetItemName} sesuai jumlah fisik dan mencatat pergerakan stok serta
            audit.
          </p>
          <p className="px-4 py-3 text-support text-on-surface-variant">
            Tidak membuat kas keluar, utang vendor, atau realisasi biaya proyek.
          </p>
        </GroupedSurface>
      </section>
    );
  }

  const delta = item.consumesBudgetActual ? item.amount : 0;
  const impact = getApprovalBudgetImpact(item.allocatedAmount, item.actualSpent, delta);
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const impactLabel = !item.consumesBudgetActual
    ? "Menjadi nilai persediaan, bukan realisasi"
    : item.allocatedAmount <= 0
      ? "Belum ada alokasi budget"
      : critical
        ? impact.overflowPercentage > 0
          ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
          : "Mencapai batas budget"
        : warning
          ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
          : "Tetap dalam batas budget";

  return (
    <section aria-label="Dampak ke budget" className="space-y-2">
      <h3 className="px-1 text-row font-bold text-on-surface">Dampak ke budget</h3>
      <GroupedSurface variant="desktopPanel">
        <div className="divide-y divide-outline-variant/40">
          <FactRow
            label="Alokasi kategori"
            value={<ApprovalAmount amount={item.allocatedAmount} />}
          />
          <FactRow label="Terpakai sekarang" value={<ApprovalAmount amount={item.actualSpent} />} />
          <FactRow label="Tambahan realisasi" value={<ApprovalAmount amount={delta} />} />
          <FactRow
            label="Proyeksi sesudah"
            value={<ApprovalAmount amount={item.actualSpent + delta} />}
          />
        </div>
        <div className="space-y-2 border-t border-outline-variant/40 px-4 py-3">
          <StatusBadge
            label={impactLabel}
            tone={critical ? "critical" : warning ? "warning" : "neutral"}
            className="max-w-full whitespace-normal"
          />
          {item.consumesBudgetActual && item.allocatedAmount > 0 ? (
            <p className="text-support text-on-surface-variant tabular-nums">
              {impact.beforePercentage.toFixed(0)}% → {impact.afterPercentage.toFixed(0)}% terpakai
            </p>
          ) : null}
        </div>
      </GroupedSurface>
    </section>
  );
}

export function ApprovalDesktopDetail({
  decisionReturnFocusRef,
  item,
  pending,
  canDecide,
  onBack,
  onOpenReceipt,
  onDecision,
}: ApprovalDesktopDetailProps): JSX.Element {
  const critical = approvalIsCritical(item);
  const warning = !critical && item.priority === "WARNING";
  const typeLabel =
    item.type === "project_cost"
      ? "Biaya lapangan"
      : item.type === "inventory_opening"
        ? "Saldo awal stok"
        : "Pembayaran vendor";
  const notes = item.notes ? cleanApprovalNotes(item.notes) : "";
  const decisionDisabled = pending || !canDecide;

  return (
    <section
      ref={decisionReturnFocusRef}
      tabIndex={-1}
      aria-label={`Rincian persetujuan ${item.description}`}
      className="@container min-w-0 space-y-3 xl:sticky xl:top-24"
    >
      <div className="xl:hidden">
        <Button variant="secondary" size="mini" disabled={pending} onClick={onBack}>
          <AppIcon name="arrow_back" className="icon-sm" /> Kembali ke daftar
        </Button>
      </div>
      <div className="grid min-w-0 items-start gap-4 @2xl:grid-cols-2">
        <GroupedSurface variant="desktopPanel" className="min-w-0">
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-support text-on-surface-variant">{typeLabel}</p>
              <StatusBadge
                label={critical ? "Risiko tinggi" : warning ? "Perlu perhatian" : "Siap ditinjau"}
                tone={critical ? "critical" : warning ? "warning" : "neutral"}
              />
            </div>
            <h2 className="text-row font-bold wrap-anywhere text-on-surface">{item.description}</h2>
            <MoneyValue
              amount={item.amount}
              fractionDigits={Number.isInteger(item.amount) ? 0 : 2}
              variant="fullDynamic"
              size="lg"
            />
            <p className="text-support text-on-surface-variant">{item.priorityReason}</p>
          </div>
          <div className="divide-y divide-outline-variant/40 border-t border-outline-variant/40">
            <FactRow
              label={item.type === "inventory_opening" ? "Ruang kerja" : "Proyek"}
              value={item.projectName}
              wrapLabel
            />
            <FactRow label="Pengaju" value={item.requestedBy} wrapLabel />
            <FactRow
              label={item.type === "inventory_opening" ? "Cakupan" : "Kategori"}
              value={item.budgetItemName}
              wrapLabel
            />
            <FactRow label="Diajukan" value={formatShortDate(item.createdAt)} />
            {item.dueDate ? (
              <FactRow label="Jatuh tempo" value={formatShortDate(item.dueDate)} />
            ) : null}
          </div>
          {notes ? (
            <div className="space-y-1 border-t border-outline-variant/40 px-4 py-3">
              <p className="text-support text-on-surface-variant">Catatan</p>
              <p className="text-support wrap-anywhere whitespace-pre-wrap text-on-surface">
                {notes}
              </p>
            </div>
          ) : null}
        </GroupedSurface>
        <div className="min-w-0 space-y-4">
          <ApprovalDesktopImpact item={item} />
          <section aria-label="Dokumen pendukung" className="space-y-2">
            <h3 className="px-1 text-row font-bold text-on-surface">Dokumen pendukung</h3>
            <ApprovalEvidenceRow item={item} onOpenReceipt={onOpenReceipt} presentation="desktop" />
          </section>
        </div>
      </div>
      {item.type === "inventory_opening" ? (
        <InventoryOpeningApprovalItems item={item} presentation="desktop" />
      ) : null}
      <GroupedSurface variant="desktopPanel" className="space-y-3 p-4">
        <p className="text-support text-on-surface-variant">
          {!canDecide
            ? "Akses Anda hanya untuk meninjau pengajuan ini."
            : item.type === "inventory_opening"
              ? "Periksa jumlah fisik dan harga pokok sebelum memberi keputusan."
              : "Persetujuan tidak langsung mencairkan pembayaran."}
        </p>
        <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2">
          <Button
            variant="criticalQuiet"
            size="compact"
            fullWidth
            disabled={decisionDisabled}
            onClick={() => {
              if (!decisionDisabled) onDecision(item, "REJECTED");
            }}
          >
            Tolak
          </Button>
          <Button
            variant="primary"
            size="compact"
            fullWidth
            disabled={decisionDisabled}
            onClick={() => {
              if (!decisionDisabled) onDecision(item, "APPROVED");
            }}
          >
            Setujui
          </Button>
        </div>
      </GroupedSurface>
    </section>
  );
}
