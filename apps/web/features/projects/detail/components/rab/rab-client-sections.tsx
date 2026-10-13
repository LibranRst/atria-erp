"use client";
import {
  AppIcon,
  Badge,
  type BadgeStatus,
  ConfirmationDialog,
  MoneyValue,
  DesktopTable,
  Button,
} from "@/components/ui";
import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import { formatShortIdr as formatShortRp } from "@atria/core/utils/money";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { NativePanel, rabSourceLabel } from "../shared/rap-rab-primitives";
import type {
  RabBundleView,
  RabEstimateView,
  RabItemView,
  RabRevisionHistoryView,
  RapView,
} from "../shared/rap-rab-manager";
import { isRabManualSourceType } from "../../types/rap-rab-types";
import { cn } from "@/lib/utils/cn";

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
  onOpenExport,
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
  readonly onOpenExport?: () => void;
}): React.JSX.Element {
  const visibleItemCount =
    rabEstimate.items.filter((item) => !item.isHidden).length +
    rabEstimate.bundles.filter((bundle) => !bundle.isHidden).length;

  const serviceFeeTotal = rabEstimate.items
    .filter((item) => !item.bundleId && !item.isHidden && item.itemNature === "SERVICE_FEE")
    .reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const productionTotal = Math.max(0, visibleRabValue - serviceFeeTotal);

  return (
    <section className="rounded-owner bg-primary p-5 text-on-primary shadow-inverse max-[430px]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge status={toBadgeStatus(rabEstimate.status)}>
            {rabStatusLabel(rabEstimate.status)}
          </Badge>
          {onOpenExport ? (
            <Button
              type="button"
              onClick={onOpenExport}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-support font-bold text-white ring-1 ring-white/15 hover:bg-white/15 active:z-10 active:shadow-raised"
              title="Export Dokumen RAB ke PDF, Gambar WhatsApp, atau Excel"
              variant="secondary"
              size="mini"
            >
              <AppIcon name="description" className="text-sm" />
              <span>Export Dokumen</span>
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 truncate text-meta text-white/60">
        {rabEstimate.title} · {visibleItemCount} item tampil
      </p>
      {serviceFeeTotal > 0 && !isRevisionDraft && (
        <div className="mt-4 border-t border-white/12 pt-3">
          <div className="grid grid-cols-2 divide-x divide-white/12 pb-2.5">
            <RabFact label="Porsi Fisik/Produksi" value={productionTotal} />
            <RabFact label="Jasa Desain & Fee" value={serviceFeeTotal} align="right" />
          </div>
          <div className="mt-2 flex items-center justify-between rounded-[14px] bg-white/5 px-3 py-2 text-meta text-white/70">
            <span className="text-[11px] text-white/60">
              Margin Fisik:{" "}
              <strong className="font-mono text-white">
                {productionTotal > 0
                  ? (((productionTotal - productionTotal * 0.9) / productionTotal) * 100).toFixed(1)
                  : "0.0"}
                %
              </strong>
            </span>
            <span className="text-[11px] text-white/60">
              Margin Total:{" "}
              <strong className="font-mono text-white">
                {visibleRabValue > 0
                  ? (
                      ((serviceFeeTotal + (productionTotal - productionTotal * 0.9)) /
                        visibleRabValue) *
                      100
                    ).toFixed(1)
                  : "0.0"}
                %
              </strong>
            </span>
          </div>
        </div>
      )}
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
          <p className="mt-1 text-meta">Perbarui jumlah dan harga tanpa mengubah label klien.</p>
          <Button
            type="button"
            onClick={handleRefreshRabSources}
            disabled={isPending}
            className="mt-3 min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary"
            variant="secondary"
          >
            Perbarui sumber
          </Button>
        </div>
      )}
      {canManageRab && rabEstimate.status === "APPROVED" && rap && (
        <Button
          type="button"
          onClick={() => setSourcePickerOpen(true)}
          className="mt-4 min-h-12 w-full rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/15"
          variant="secondary"
        >
          Buat revisi RAB
        </Button>
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
    <div className={cn(className, "space-y-2")}>
      <p className="truncate text-[8px] font-bold tracking-wide text-white/50 uppercase">{label}</p>
      <MoneyValue
        amount={value}
        variant="fullDynamic"
        tone={danger ? "danger" : "inverse"}
        size="md"
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
  const desktop = useWorkspacePresentation() === "desktop";
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
            <AppIcon name="add" />
          </button>
        ) : undefined
      }
    >
      {desktop ? (
        <div id="rab-items" className="space-y-4">
          {rabEstimate.bundles.length > 0 ? (
            <DesktopTable
              ariaLabel="Paket RAB klien"
              rows={rabEstimate.bundles}
              rowKey={(bundle) => bundle.id}
              columns={[
                {
                  key: "bundle",
                  label: "Paket",
                  render: (bundle) => (
                    <div>
                      <p className="font-semibold">{bundle.clientLabel}</p>
                      <p className="text-meta text-on-surface-variant">{bundle.description}</p>
                    </div>
                  ),
                },
                {
                  key: "qty",
                  label: "Jumlah",
                  align: "end",
                  render: (bundle) => `${bundle.quantity} ${bundle.unit}`,
                },
                {
                  key: "price",
                  label: "Harga satuan",
                  align: "end",
                  render: (bundle) => (
                    <MoneyValue amount={Number(bundle.unitPrice)} variant="compact" size="sm" />
                  ),
                },
                {
                  key: "total",
                  label: "Total",
                  align: "end",
                  render: (bundle) => (
                    <MoneyValue amount={Number(bundle.lineTotal)} variant="compact" size="sm" />
                  ),
                },
                {
                  key: "display",
                  label: "Tampilan",
                  render: (bundle) => (bundle.isHidden ? "Disembunyikan" : "Tampil ke klien"),
                },
                {
                  key: "action",
                  label: "Tindakan",
                  render: (bundle) =>
                    rabEstimate.status === "DRAFT" && canManageRab ? (
                      <Button variant="secondary" onClick={() => openEditBundle(bundle)}>
                        Edit paket
                      </Button>
                    ) : null,
                },
              ]}
            />
          ) : null}
          <DesktopTable
            ariaLabel="Item RAB klien"
            rows={sortedRabItems.filter((item) => !item.bundleId)}
            rowKey={(item) => item.id}
            onRowAction={(item) => setRabItemEditorId(item.id)}
            columns={[
              {
                key: "item",
                label: "Item",
                render: (item) => (
                  <div>
                    <p className="font-semibold">{item.clientLabel}</p>
                    <p className="text-meta text-on-surface-variant">{item.description}</p>
                  </div>
                ),
              },
              {
                key: "qty",
                label: "Jumlah",
                align: "end",
                render: (item) => `${item.quantity} ${item.unit}`,
              },
              {
                key: "price",
                label: "Harga satuan",
                align: "end",
                render: (item) => (
                  <MoneyValue amount={Number(item.unitPrice)} variant="compact" size="sm" />
                ),
              },
              {
                key: "total",
                label: "Total",
                align: "end",
                render: (item) => (
                  <MoneyValue amount={Number(item.lineTotal)} variant="compact" size="sm" />
                ),
              },
              {
                key: "display",
                label: "Tampilan",
                render: (item) => (item.isHidden ? "Disembunyikan" : "Tampil ke klien"),
              },
            ]}
          />
        </div>
      ) : (
        <>
          {" "}
          <div
            id="rab-items"
            className="divide-y divide-outline-variant/25 overflow-hidden rounded-inset bg-surface-container-low"
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
        </>
      )}
      {canBundle && (
        <Button
          type="button"
          onClick={openCreateBundle}
          className="mt-sm min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary ring-1 ring-primary/15"
          variant="secondary"
        >
          Buat paket RAB
        </Button>
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
            <Button
              type="button"
              onClick={() =>
                document.getElementById("rab-items")?.scrollIntoView({ behavior: "smooth" })
              }
              className="min-h-12 w-full rounded-full bg-surface-container-low text-xs font-bold"
              variant="secondary"
            >
              Lanjut edit
            </Button>
            <Button
              type="button"
              onClick={() => setChangeOrderOpen(true)}
              className="min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary"
              variant="primary"
            >
              Proses change order
            </Button>
            <Button
              type="button"
              onClick={() => setVoidRevisionOpen(true)}
              className="min-h-12 w-full rounded-full bg-error-container/25 text-xs font-bold text-error"
              variant="criticalQuiet"
            >
              Batalkan revisi
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => setConfirmApprove(true)}
            disabled={isPending || rabEstimate.items.length === 0}
            className="min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary disabled:opacity-40"
            variant="primary"
          >
            Tinjau & Setujui RAB
          </Button>
        )}
      </NativePanel>
      <ConfirmationDialog
        open={confirmApprove}
        title="Setujui RAB klien?"
        description="RAB menjadi baseline klien yang tidak dapat diedit langsung. Perubahan berikutnya harus melalui revisi dan Change Order."
        tone="warning"
        onClose={() => setConfirmApprove(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setConfirmApprove(false)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold active:z-10 active:shadow-raised"
              variant="secondary"
            >
              Kembali
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => {
                setConfirmApprove(false);
                handleApproveRab();
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white outline-none active:z-10 active:shadow-raised disabled:opacity-40"
              variant="primary"
            >
              Setujui RAB
            </Button>
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
          <AppIcon name="inventory_2" className="text-[19px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{bundle.clientLabel}</span>
          <span className="block text-meta text-on-surface-variant">
            Paket - {bundle.itemIds.length} item - {bundle.quantity} {bundle.unit}
          </span>
        </span>
        <span className="shrink-0 font-mono text-support font-bold text-primary">
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
  const isService = item.itemNature === "SERVICE_FEE";
  return (
    <button
      type="button"
      onClick={() => setRabItemEditorId(item.id)}
      className="w-full p-3 text-left outline-none focus-visible:bg-white/65 active:bg-white/65"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isService ? "bg-secondary-container/40 text-secondary" : "bg-white/75 text-primary"}`}
        >
          <AppIcon
            name={
              isService
                ? "design_services"
                : isRabManualSourceType(item.sourceType)
                  ? "edit_note"
                  : "format_list_bulleted"
            }
            className="text-[19px]"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">{item.clientLabel}</span>
            {isService && (
              <span className="inline-flex shrink-0 rounded-full bg-secondary-container/50 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                Jasa & Fee
              </span>
            )}
          </span>
          <span className="block truncate text-meta text-on-surface-variant">
            {rabSourceLabel(item.sourceType, item.itemNature)} · {item.quantity} {item.unit}
          </span>
          {item.isHidden && (
            <span className="mt-1 inline-flex rounded-full bg-error-container/30 px-2 py-0.5 text-eyebrow font-bold text-error">
              Disembunyikan
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-support font-bold">
          {formatShortRp(Number(item.lineTotal))}
        </span>
      </div>
    </button>
  );
}
