"use client";

import React from "react";
import { motion } from "framer-motion";

import { ConfirmationModal } from "@/components/ui";
import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { MetricGrid, MoneyValue } from "@/components/ui/page-primitives";
import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  MiniMoneyMetric,
  NativePanel,
  rabSourceLabel,
} from "../shared/rap-rab-primitives";
import type {
  RabBundleView,
  RabEstimateView,
  RabItemView,
  RabRevisionHistoryView,
  RapView,
} from "../shared/rap-rab-manager";

function toBadgeStatus(status: string): BadgeStatus {
  if (status === "LOCKED" || status === "READY" || status === "APPROVED") {
    return "APPROVED";
  }
  if (status === "SHORTAGE" || status === "WAITING_PURCHASE") {
    return "WARNING";
  }
  if (status === "DRAFT" || status === "PLANNED") {
    return "DRAFT";
  }
  return "PRIMARY";
}

export function RabClientSummaryPanel({
  rabEstimate,
  isRevisionDraft,
  approvedBaseline,
  visibleRabValue,
  staleSourceLabels,
  isPending,
  handleRefreshRabSources,
  canManageRab,
  rap,
  setSourcePickerOpen,
}: {
  readonly rabEstimate: RabEstimateView;
  readonly isRevisionDraft: boolean;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly visibleRabValue: number;
  readonly staleSourceLabels: readonly string[];
  readonly isPending: boolean;
  readonly handleRefreshRabSources: () => void;
  readonly canManageRab: boolean;
  readonly rap: RapView | null;
  readonly setSourcePickerOpen: (open: boolean) => void;
}): React.JSX.Element {
  const visibleItemCount =
    rabEstimate.items.filter((item) => !item.isHidden).length +
    rabEstimate.bundles.filter((bundle) => !bundle.isHidden).length;

  return (
    <NativePanel
      eyebrow={isRevisionDraft ? "Revisi aktif" : "RAB Klien"}
      title={isRevisionDraft ? `Revisi R${rabEstimate.revision}` : rabEstimate.title}
      action={
        <Badge status={toBadgeStatus(rabEstimate.status)}>
          {rabEstimate.status}
        </Badge>
      }
    >
      <div className="rounded-[28px] bg-primary p-md text-on-primary">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/65">
          Nilai RAB
        </p>
        <MoneyValue
          amount={visibleRabValue}
          variant="fullDynamic"
          tone="inverse"
          size="lg"
          className="mt-1"
        />
        <div className="mt-3 flex justify-between text-[10px] text-white/70">
          <span>R{rabEstimate.revision}</span>
          <span>{visibleItemCount} item tampil</span>
        </div>
      </div>
      {isRevisionDraft && approvedBaseline && (
        <MetricGrid className="mt-sm">
          <MiniMoneyMetric
            label="Disetujui"
            value={approvedBaseline.value}
          />
          <MiniMoneyMetric label="Revisi" value={visibleRabValue} />
          <MiniMoneyMetric
            label="Selisih"
            value={visibleRabValue - approvedBaseline.value}
            prefix={visibleRabValue - approvedBaseline.value >= 0 ? "+" : ""}
            danger={visibleRabValue < approvedBaseline.value}
          />
        </MetricGrid>
      )}
      {rabEstimate.status === "DRAFT" && staleSourceLabels.length > 0 && (
        <div className="mt-sm rounded-2xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
          <p className="text-xs font-bold">
            {staleSourceLabels.length} sumber berubah
          </p>
          <p className="mt-1 text-[10px]">
            Perbarui jumlah dan harga tanpa mengubah label klien.
          </p>
          <button
            type="button"
            onClick={handleRefreshRabSources}
            disabled={isPending}
            className="mt-3 min-h-11 w-full rounded-full bg-white text-xs font-bold"
          >
            Perbarui Sumber
          </button>
        </div>
      )}
      {canManageRab && rabEstimate.status === "APPROVED" && rap && (
        <button
          type="button"
          onClick={() => setSourcePickerOpen(true)}
          className="mt-sm min-h-11 w-full rounded-full bg-primary/10 text-xs font-bold text-primary"
        >
          Buat Revisi RAB
        </button>
      )}
    </NativePanel>
  );
}

export function RabItemsPanel({
  rabEstimate,
  canManageRab,
  setManualLineOpen,
  openEditBundle,
  setRabItemEditorId,
  sortedRabItems,
  openCreateBundle,
}: {
  readonly rabEstimate: RabEstimateView;
  readonly canManageRab: boolean;
  readonly setManualLineOpen: (open: boolean) => void;
  readonly openEditBundle: (bundle: RabBundleView) => void;
  readonly setRabItemEditorId: (id: string | null) => void;
  readonly sortedRabItems: readonly RabItemView[];
  readonly openCreateBundle: () => void;
}): React.JSX.Element {
  const canBundle =
    canManageRab &&
    rabEstimate.status === "DRAFT" &&
    rabEstimate.items.filter((item) => !item.isHidden && !item.bundleId)
      .length >= 2;

  return (
    <NativePanel
      eyebrow="Aman untuk klien"
      title="Item RAB"
      action={
        canManageRab && rabEstimate.status === "DRAFT" ? (
          <button
            type="button"
            onClick={() => setManualLineOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary"
            aria-label="Tambah item manual"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        ) : undefined
      }
    >
      <div id="rab-items" className="space-y-2">
        {rabEstimate.bundles.map((bundle) => (
          <RabBundleRow
            key={bundle.id}
            bundle={bundle}
            isDraft={rabEstimate.status === "DRAFT"}
            openEditBundle={openEditBundle}
          />
        ))}
        {sortedRabItems
          .filter((item) => !item.bundleId)
          .map((item) => (
            <RabItemRow
              key={item.id}
              item={item}
              setRabItemEditorId={setRabItemEditorId}
            />
          ))}
        {rabEstimate.items.length === 0 && (
          <div className="rounded-2xl bg-surface-container-low p-md text-center text-xs text-on-surface-variant">
            Belum ada item RAB.
          </div>
        )}
      </div>
      {canBundle && (
        <button
          type="button"
          onClick={openCreateBundle}
          className="mt-sm min-h-11 w-full rounded-full bg-white text-xs font-bold text-primary ring-1 ring-primary/15"
        >
          Buat Paket RAB
        </button>
      )}
    </NativePanel>
  );
}

export function RabDraftActionsPanel({
  rabEstimate,
  isRevisionDraft,
  isPending,
  setChangeOrderOpen,
  setVoidRevisionOpen,
  handleApproveRab,
}: {
  readonly rabEstimate: RabEstimateView;
  readonly isRevisionDraft: boolean;
  readonly isPending: boolean;
  readonly setChangeOrderOpen: (open: boolean) => void;
  readonly setVoidRevisionOpen: (open: boolean) => void;
  readonly handleApproveRab: () => void;
}): React.JSX.Element {
  const [confirmApprove, setConfirmApprove] = React.useState(false);
  return (
    <>
    <NativePanel
      eyebrow="Aksi draf"
      title={isRevisionDraft ? "Selesaikan revisi" : "Selesaikan RAB"}
    >
      {isRevisionDraft ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("rab-items")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="min-h-11 w-full rounded-full bg-surface-container-low text-xs font-bold"
          >
            Lanjut Edit
          </button>
          <button
            type="button"
            onClick={() => setChangeOrderOpen(true)}
            className="min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary"
          >
            Proses Change Order
          </button>
          <button
            type="button"
            onClick={() => setVoidRevisionOpen(true)}
            className="min-h-11 w-full rounded-full bg-error-container/25 text-xs font-bold text-error"
          >
            Batalkan Revisi
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmApprove(true)}
          disabled={isPending || rabEstimate.items.length === 0}
          className="min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary disabled:opacity-40"
        >
          Tinjau & Setujui RAB
        </button>
      )}
    </NativePanel>
    <ConfirmationModal
      open={confirmApprove}
      title="Setujui RAB client?"
      description="RAB menjadi baseline client yang immutable. Perubahan berikutnya harus melalui revisi dan Change Order."
      tone="warning"
      onClose={() => setConfirmApprove(false)}
      actions={(
        <div className="grid grid-cols-2 gap-2">
          <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmApprove(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Kembali</motion.button>
          <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={isPending} onClick={() => { setConfirmApprove(false); handleApproveRab(); }} className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40">Setujui RAB</motion.button>
        </div>
      )}
    />
    </>
  );
}

function RabBundleRow({
  bundle,
  isDraft,
  openEditBundle,
}: {
  readonly bundle: RabBundleView;
  readonly isDraft: boolean;
  readonly openEditBundle: (bundle: RabBundleView) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => isDraft && openEditBundle(bundle)}
      className="w-full rounded-2xl bg-primary/5 p-3 text-left ring-1 ring-primary/10"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[19px]">
            inventory_2
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {bundle.clientLabel}
          </span>
          <span className="block text-[10px] text-on-surface-variant">
            Paket - {bundle.itemIds.length} item - {bundle.quantity}{" "}
            {bundle.unit}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] font-bold text-primary">
          {formatShortRp(Number(bundle.lineTotal))}
        </span>
      </div>
    </button>
  );
}

function RabItemRow({
  item,
  setRabItemEditorId,
}: {
  readonly item: RabItemView;
  readonly setRabItemEditorId: (id: string | null) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => setRabItemEditorId(item.id)}
      className="w-full rounded-2xl bg-surface-container-low p-3 text-left"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
          <span className="material-symbols-outlined text-[19px]">
            {item.sourceType === "MANUAL" ? "edit_note" : "format_list_bulleted"}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {item.clientLabel}
          </span>
          <span className="block truncate text-[10px] text-on-surface-variant">
            {rabSourceLabel(item.sourceType)} - {item.quantity} {item.unit}
          </span>
          {item.isHidden && (
            <span className="mt-1 inline-flex rounded-full bg-error-container/30 px-2 py-0.5 text-[9px] font-bold text-error">
              Disembunyikan
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-[11px] font-bold">
          {formatShortRp(Number(item.lineTotal))}
        </span>
      </div>
    </button>
  );
}
