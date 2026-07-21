"use client";

import React from "react";
import { motion } from "framer-motion";

import { ConfirmationModal } from "@/components/ui";
import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { MoneyValue } from "@/components/ui/page-primitives";
import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { NativePanel, rabSourceLabel } from "../shared/rap-rab-primitives";
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

function rabStatusLabel(status: string): string {
  if (status === "APPROVED") return "Disetujui";
  if (status === "DRAFT") return "Draf";
  if (status === "VOID") return "Dibatalkan";
  return formatBusinessLabel(status);
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
    <section className="rounded-[28px] bg-primary p-5 text-on-primary shadow-[0_16px_38px_rgba(17,17,17,0.13)] max-[430px]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.16em] text-white/55 uppercase">
            {isRevisionDraft ? `Revisi RAB R${rabEstimate.revision}` : "Nilai RAB klien"}
          </p>
          <MoneyValue
            amount={visibleRabValue}
            variant="fullDynamic"
            tone="inverse"
            size="hero"
            className="mt-1"
          />
        </div>
        <Badge status={toBadgeStatus(rabEstimate.status)}>
          {rabStatusLabel(rabEstimate.status)}
        </Badge>
      </div>
      <p className="mt-1 truncate text-[10px] text-white/60">
        {rabEstimate.title} · {visibleItemCount} item tampil
      </p>
      {isRevisionDraft && approvedBaseline && (
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 pt-4">
          <RabFact label="Disetujui" value={approvedBaseline.value} />
          <RabFact label="Revisi" value={visibleRabValue} align="center" />
          <RabFact
            label="Selisih"
            value={visibleRabValue - approvedBaseline.value}
            align="right"
            danger={visibleRabValue < approvedBaseline.value}
          />
        </div>
      )}
      {rabEstimate.status === "DRAFT" && staleSourceLabels.length > 0 && (
        <div className="mt-4 rounded-[18px] bg-warning/15 p-3 text-white ring-1 ring-warning/25">
          <p className="text-xs font-bold">{staleSourceLabels.length} sumber berubah</p>
          <p className="mt-1 text-[10px]">Perbarui jumlah dan harga tanpa mengubah label klien.</p>
          <button
            type="button"
            onClick={handleRefreshRabSources}
            disabled={isPending}
            className="mt-3 min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary"
          >
            Perbarui sumber
          </button>
        </div>
      )}
      {canManageRab && rabEstimate.status === "APPROVED" && rap && (
        <button
          type="button"
          onClick={() => setSourcePickerOpen(true)}
          className="mt-4 min-h-12 w-full rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/15"
        >
          Buat revisi RAB
        </button>
      )}
    </section>
  );
}

function RabFact({
  label,
  value,
  align = "left",
  danger = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly align?: "left" | "center" | "right";
  readonly danger?: boolean;
}): React.JSX.Element {
  const className =
    align === "center" ? "px-2 text-center" : align === "right" ? "pl-2 text-right" : "pr-2";
  return (
    <div className={className}>
      <p className="truncate text-[8px] font-bold tracking-wide text-white/50 uppercase">{label}</p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        tone={danger ? "danger" : "inverse"}
        size="xs"
        align={align === "right" ? "right" : "left"}
        className={align === "center" ? "text-center" : ""}
      />
    </div>
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
    rabEstimate.items.filter((item) => !item.isHidden && !item.bundleId).length >= 2;

  return (
    <NativePanel
      eyebrow="Aman untuk klien"
      title="Item RAB"
      action={
        canManageRab && rabEstimate.status === "DRAFT" ? (
          <button
            type="button"
            onClick={() => setManualLineOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary"
            aria-label="Tambah item manual"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        ) : undefined
      }
    >
      <div
        id="rab-items"
        className="divide-y divide-outline-variant/25 overflow-hidden rounded-[20px] bg-surface-container-low"
      >
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
            <RabItemRow key={item.id} item={item} setRabItemEditorId={setRabItemEditorId} />
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
          className="mt-sm min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary ring-1 ring-primary/15"
        >
          Buat paket RAB
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
        eyebrow="Keputusan draf"
        title={isRevisionDraft ? "Selesaikan revisi" : "Selesaikan RAB"}
      >
        {isRevisionDraft ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() =>
                document.getElementById("rab-items")?.scrollIntoView({ behavior: "smooth" })
              }
              className="min-h-12 w-full rounded-full bg-surface-container-low text-xs font-bold"
            >
              Lanjut edit
            </button>
            <button
              type="button"
              onClick={() => setChangeOrderOpen(true)}
              className="min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary"
            >
              Proses change order
            </button>
            <button
              type="button"
              onClick={() => setVoidRevisionOpen(true)}
              className="min-h-12 w-full rounded-full bg-error-container/25 text-xs font-bold text-error"
            >
              Batalkan revisi
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
        title="Setujui RAB klien?"
        description="RAB menjadi baseline klien yang tidak dapat diedit langsung. Perubahan berikutnya harus melalui revisi dan Change Order."
        tone="warning"
        onClose={() => setConfirmApprove(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setConfirmApprove(false)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold"
            >
              Kembali
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={isPending}
              onClick={() => {
                setConfirmApprove(false);
                handleApproveRab();
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40"
            >
              Setujui RAB
            </motion.button>
          </div>
        }
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
      className="w-full p-3 text-left outline-none focus-visible:bg-primary/5 active:bg-primary/5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[19px]">inventory_2</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{bundle.clientLabel}</span>
          <span className="block text-[10px] text-on-surface-variant">
            Paket - {bundle.itemIds.length} item - {bundle.quantity} {bundle.unit}
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
      className="w-full p-3 text-left outline-none focus-visible:bg-white/65 active:bg-white/65"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/75 text-primary">
          <span className="material-symbols-outlined text-[19px]">
            {item.sourceType === "MANUAL" ? "edit_note" : "format_list_bulleted"}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{item.clientLabel}</span>
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
