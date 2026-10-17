"use client";

import React from "react";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  settingsTablePageRows,
  useSettingsTableState,
} from "@/features/settings/hooks/use-settings-table-state";
import { toast } from "sonner";

import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import {
  ConfirmationDialog,
  DetailSheet,
  DuotoneIconTile,
  MoneyValue,
  WorkspaceRowChevron,
  Button,
  DesktopTable,
  DesktopTablePagination,
  GroupedSurface,
  WorkspaceStatusLabel,
  type DesktopTableColumn,
} from "@/components/ui";
import { OpeningInventoryEntryForm } from "@/features/materials/components/workspaces/opening-inventory-entry-form";
import { OnboardingFinanceReview } from "@/features/onboarding/components/workspaces/onboarding-finance-review";
import { startDeveloperAccountSimulation } from "@/app/actions/developer-account-simulation";
import type { DeveloperAccountSimulationState } from "@atria/core/auth/developer-account-simulation";
import {
  OnboardingNotice,
  OnboardingStage,
  OnboardingSurface,
} from "../shared/onboarding-primitives";
function batchStatus(status: string): string {
  if (status === "PENDING_APPROVAL") return "Menunggu persetujuan";
  if (status === "POSTED") return "Sudah diposting";
  if (status === "REJECTED") return "Ditolak";
  if (status === "REVERSED") return "Sudah dibalik";
  return formatBusinessLabel(status);
}

function OpeningDetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 px-4 py-3.5 text-xs">
      <span className="shrink-0 leading-5 font-medium text-on-surface-variant">{label}</span>
      <strong className="min-w-0 flex-1 text-right leading-5 font-bold wrap-anywhere text-on-surface">
        {children}
      </strong>
    </div>
  );
}

export function InitialStockSetupPanel({
  candidates,
  batches,
  onMutationComplete,
  onNoLegacyStock,
  onSkip,
  simulation,
  presentation = "onboarding",
  pending = false,
}: {
  readonly candidates: readonly InitialStockCandidate[];
  readonly batches: readonly InventoryOpeningBatchView[];
  readonly onMutationComplete: () => void;
  readonly onNoLegacyStock: () => void;
  readonly onSkip: () => void;
  readonly simulation: DeveloperAccountSimulationState | null;
  readonly presentation?: "onboarding" | "settings";
  readonly pending?: boolean;
}): React.JSX.Element {
  const can = useCan();
  const canCreate = presentation !== "settings" || can("create:opening_inventory");
  const canDecide =
    presentation !== "settings" || can("manage:onboarding") || can("create:opening_inventory");
  const desktopSettings = useWorkspacePresentation() === "desktop" && presentation === "settings";
  const batchTable = useSettingsTableState<InventoryOpeningBatchView>("batch");
  const itemTable = useSettingsTableState<InventoryOpeningBatchView["items"][number]>("material");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [detailBatch, setDetailBatch] = React.useState<InventoryOpeningBatchView | null>(null);
  const [simulationBatch, setSimulationBatch] = React.useState<InventoryOpeningBatchView | null>(
    null,
  );
  const [simulationConfirmationBatch, setSimulationConfirmationBatch] =
    React.useState<InventoryOpeningBatchView | null>(null);
  const [simulationPending, startSimulationTransition] = React.useTransition();
  const eligible = candidates.filter((row) => row.eligible).length;
  const postedBatch = batches.find((batch) => batch.status === "POSTED");
  const pendingBatchCount = batches.filter((batch) => batch.status === "PENDING_APPROVAL").length;
  const financeTarget = simulation?.onboardingReviewTargets?.[0];

  function openBatch(batch: InventoryOpeningBatchView): void {
    itemTable.resetPage();
    setDetailBatch(batch);
  }
  const batchColumns: readonly DesktopTableColumn<InventoryOpeningBatchView>[] = [
    {
      key: "batch",
      label: "Pengajuan",
      sortable: true,
      sortValue: (batch) => batch.batchNumber,
      render: (batch) => (
        <div>
          <p className="font-semibold">{batch.batchNumber}</p>
          <p className="mt-1 text-support text-on-surface-variant">{batch.requestedByName}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (batch) => batchStatus(batch.status),
      render: (batch) => (
        <WorkspaceStatusLabel
          label={batchStatus(batch.status)}
          tone={
            batch.status === "REJECTED"
              ? "warning"
              : batch.status === "REVERSED"
                ? "inactive"
                : "neutral"
          }
        />
      ),
    },
    {
      key: "count",
      label: "Item",
      align: "end",
      sortable: true,
      sortValue: (batch) => batch.itemCount,
      render: (batch) => batch.itemCount.toLocaleString("id-ID"),
    },
    {
      key: "value",
      label: "Nilai saldo awal",
      align: "end",
      sortable: true,
      sortValue: (batch) => batch.totalValue,
      render: (batch) => <MoneyValue amount={batch.totalValue} variant="compact" size="sm" />,
    },
    ...(simulation?.enabled && financeTarget
      ? [
          {
            key: "simulation",
            label: "Tinjau",
            render: (batch: InventoryOpeningBatchView) =>
              batch.status === "PENDING_APPROVAL" ? (
                <Button
                  type="button"
                  variant="quiet"
                  size="compact"
                  disabled={simulationPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSimulationConfirmationBatch(batch);
                  }}
                >
                  Simulasikan Finance
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  const itemColumns: readonly DesktopTableColumn<InventoryOpeningBatchView["items"][number]>[] = [
    {
      key: "material",
      label: "Material & lokasi",
      sortable: true,
      sortValue: (item) => item.materialName,
      render: (item) => (
        <div>
          <p className="font-semibold">{item.materialName}</p>
          <p className="mt-1 text-support text-on-surface-variant">{item.locationName}</p>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Jumlah fisik",
      align: "end",
      sortable: true,
      sortValue: (item) => item.quantity,
      render: (item) =>
        `${item.quantity.toLocaleString("id-ID", { maximumFractionDigits: 20 })} ${item.unit}`,
    },
    {
      key: "cost",
      label: "Harga per unit",
      align: "end",
      sortable: true,
      sortValue: (item) => item.unitCost,
      render: (item) => (
        <MoneyValue
          amount={item.unitCost}
          variant="fullDynamic"
          fractionDigits={Number.isInteger(item.unitCost) ? 0 : 2}
          size="sm"
        />
      ),
    },
    {
      key: "value",
      label: "Subtotal",
      align: "end",
      sortable: true,
      sortValue: (item) => item.totalValue,
      render: (item) => (
        <MoneyValue
          amount={item.totalValue}
          variant="fullDynamic"
          fractionDigits={Number.isInteger(item.totalValue) ? 0 : 2}
          size="sm"
        />
      ),
    },
    {
      key: "average",
      label: "Biaya rata-rata",
      align: "end",
      render: (item) =>
        detailBatch?.status === "POSTED" ? (
          <MoneyValue
            amount={item.averageCost}
            variant="fullDynamic"
            fractionDigits={Number.isInteger(item.averageCost) ? 0 : 2}
            size="sm"
          />
        ) : (
          "Belum diposting"
        ),
    },
  ];

  function confirmFinanceSimulation(): void {
    if (!financeTarget || !simulationConfirmationBatch) return;
    const batch = simulationConfirmationBatch;
    startSimulationTransition(async () => {
      const result = await startDeveloperAccountSimulation({
        targetUserId: financeTarget.id,
        context: "ONBOARDING_SETUP_REVIEW",
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      setSimulationConfirmationBatch(null);
      setSimulationBatch(batch);
      toast.success(`Simulasi Finance aktif sebagai ${financeTarget.name}.`);
    });
  }

  if (simulationBatch)
    return <OnboardingFinanceReview pendingBatches={[simulationBatch]} simulated />;

  return (
    <OnboardingStage>
      {desktopSettings ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <GroupedSurface variant="desktopPanel" className="p-4">
            <h2 className="text-title font-bold text-on-surface">
              {postedBatch ? "Saldo awal sudah disetujui" : "Siapkan saldo awal stok"}
            </h2>
            <p className="mt-2 text-support text-on-surface-variant">
              {postedBatch
                ? `Stok fisik dan harga rata-rata sudah ditambahkan oleh ${postedBatch.approvedByName ?? "pemeriksa"}. Kas tidak berubah.`
                : `${eligible} pasangan material dan lokasi memenuhi syarat untuk dicatat dari hasil hitung fisik dan harga pokok lama.`}
            </p>
            {pendingBatchCount > 0 ? (
              <p className="mt-2 text-support text-on-surface-variant">
                {pendingBatchCount} pengajuan menunggu persetujuan.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canCreate && (!postedBatch || eligible > 0) ? (
                <Button
                  type="button"
                  size="compact"
                  disabled={pending || eligible === 0}
                  onClick={() => setComposerOpen(true)}
                >
                  {postedBatch ? "Catat saldo awal lainnya" : "Catat saldo awal"}
                </Button>
              ) : null}
              {!postedBatch && canDecide ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    disabled={pending}
                    onClick={onNoLegacyStock}
                  >
                    Tidak ada stok lama
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    size="compact"
                    disabled={pending}
                    onClick={onSkip}
                  >
                    Isi nanti
                  </Button>
                </>
              ) : null}
            </div>
            {!canCreate && !canDecide ? (
              <p className="mt-3 text-support text-on-surface-variant">
                Anda dapat meninjau pengajuan. Pencatatan dan keputusan stok awal memerlukan izin
                terkait.
              </p>
            ) : null}
            {!postedBatch ? (
              <p className="mt-3 text-support text-on-surface-variant">
                {eligible === 0
                  ? "Lengkapi lokasi dan Material Master terlebih dahulu. Mulai dari nol jika tidak ada stok lama."
                  : "Catat manual atau import CSV. Pengajuan belum menambah stok sampai Finance Admin atau Owner lain menyetujui."}
              </p>
            ) : null}
          </GroupedSurface>
          <section className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title font-bold text-on-surface">Pengajuan saldo awal</h2>
              <p className="text-support text-on-surface-variant">{batches.length} pengajuan</p>
            </div>
            <DesktopTable
              ariaLabel="Pengajuan saldo awal stok"
              columns={batchColumns}
              rows={settingsTablePageRows(batches, batchColumns, batchTable)}
              rowKey={(batch) => batch.id}
              onRowAction={openBatch}
              sortDescriptor={batchTable.sortDescriptor}
              onSortChange={batchTable.onSortChange}
              emptyTitle="Belum ada pengajuan saldo awal"
              emptyDescription="Catat saldo awal jika perusahaan memiliki stok lama."
              footer={
                batches.length > 10 ? (
                  <DesktopTablePagination
                    page={batchTable.page}
                    pageSize={batchTable.pageSize}
                    total={batches.length}
                    onPageChange={batchTable.onPageChange}
                    onPageSizeChange={batchTable.onPageSizeChange}
                    ariaLabel="Halaman pengajuan saldo awal"
                  />
                ) : undefined
              }
            />
          </section>
        </div>
      ) : (
        <>
          {postedBatch ? (
            <OnboardingSurface>
              <div className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <DuotoneIconTile name="task_alt" tone="success" />
                  <div className="min-w-0 flex-1">
                    <p className="text-row font-bold text-on-surface">Saldo awal sudah disetujui</p>
                    <p className="mt-1 text-meta text-on-surface-variant">
                      Stok fisik dan harga rata-rata sudah ditambahkan oleh{" "}
                      {postedBatch.approvedByName ?? "pemeriksa"}. Kas tidak berubah.
                    </p>
                    {pendingBatchCount > 0 ? (
                      <p className="mt-2 text-meta font-semibold text-warning-on-container">
                        {pendingBatchCount} pengajuan lain masih menunggu persetujuan.
                      </p>
                    ) : null}
                  </div>
                </div>
                {canCreate && eligible > 0 ? (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => setComposerOpen(true)}
                    className="mt-4 min-h-12 w-full rounded-full bg-surface-container-low px-4 text-row font-bold text-on-surface ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:z-10 active:shadow-raised"
                    variant="secondary"
                  >
                    Catat saldo awal lainnya
                  </Button>
                ) : null}
              </div>
            </OnboardingSurface>
          ) : (
            <OnboardingSurface>
              <div className="divide-y divide-outline-variant/20">
                {canDecide ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onNoLegacyStock}
                    className="flex min-h-16.5 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
                  >
                    <DuotoneIconTile name="archive" tone="neutral" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-row font-bold text-on-surface">
                        Tidak ada stok lama
                      </span>
                      <span className="mt-0.5 block text-meta text-on-surface-variant">
                        Mulai inventory dari nol.
                      </span>
                    </span>
                    <WorkspaceRowChevron />
                  </button>
                ) : null}
                {canCreate ? (
                  <button
                    type="button"
                    disabled={pending || eligible === 0}
                    onClick={() => setComposerOpen(true)}
                    className="flex min-h-16.5 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low disabled:cursor-not-allowed"
                  >
                    <DuotoneIconTile
                      name="inventory_2"
                      tone={eligible === 0 ? "neutral" : "accent"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-row font-bold text-on-surface">
                        Ada stok lama
                      </span>
                      <span className="mt-0.5 block text-meta text-on-surface-variant">
                        {eligible === 0
                          ? "Daftarkan materialnya lebih dulu pada langkah material."
                          : "Catat manual atau import CSV."}
                      </span>
                    </span>
                    <WorkspaceRowChevron />
                  </button>
                ) : null}
                {canDecide ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onSkip}
                    className="flex min-h-16.5 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
                  >
                    <DuotoneIconTile name="schedule" tone="neutral" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-row font-bold text-on-surface">Isi nanti</span>
                      <span className="mt-0.5 block text-meta text-on-surface-variant">
                        Langkah ini tetap perlu dilengkapi sebelum setup selesai.
                      </span>
                    </span>
                    <WorkspaceRowChevron />
                  </button>
                ) : null}
              </div>
            </OnboardingSurface>
          )}
          {batches.length > 0 ? (
            <OnboardingSurface>
              <div className="divide-y divide-outline-variant/20">
                {batches.map((batch) => (
                  <div key={batch.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openBatch(batch)}
                      className="flex min-h-14 w-full items-center gap-3 text-left"
                    >
                      <DuotoneIconTile name="inventory_2" tone="neutral" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-row font-bold text-on-surface">
                          {batch.batchNumber}
                        </span>
                        <span className="mt-0.5 block text-meta text-on-surface-variant">
                          {batch.itemCount} item · {batchStatus(batch.status)}
                        </span>
                      </span>
                      <MoneyValue
                        amount={batch.totalValue}
                        variant="compact"
                        size="sm"
                        align="right"
                      />
                      <WorkspaceRowChevron />
                    </button>
                    {batch.status === "PENDING_APPROVAL" && simulation?.enabled && financeTarget ? (
                      <Button
                        type="button"
                        disabled={simulationPending}
                        onClick={() => setSimulationConfirmationBatch(batch)}
                        className="mt-2 min-h-12 w-full rounded-full bg-accent px-4 text-meta font-bold text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:z-10 active:shadow-raised disabled:opacity-40"
                        variant="secondary"
                      >
                        Simulasikan Finance Admin
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </OnboardingSurface>
          ) : null}
          {!postedBatch && eligible === 0 ? (
            <OnboardingNotice icon="lock" tone="warning">
              Belum ada inventory saldo nol yang memenuhi syarat. Lengkapi lokasi dan Material
              Master lebih dahulu.
            </OnboardingNotice>
          ) : !postedBatch ? (
            <OnboardingNotice icon="verified_user">
              Setelah diajukan, stok tetap nol sampai Finance Admin atau Owner lain menyetujuinya.
            </OnboardingNotice>
          ) : null}
        </>
      )}
      <OpeningInventoryEntryForm
        desktopLayout={presentation === "settings"}
        eligibleInventory={candidates.filter((row) => row.eligible)}
        presentation="sheet"
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onMutationComplete={() => {
          setComposerOpen(false);
          onMutationComplete();
        }}
      />
      <DetailSheet
        open={detailBatch !== null}
        title="Detail saldo awal"
        desktopSize={desktopSettings ? "wide" : undefined}
        onClose={() => setDetailBatch(null)}
      >
        {detailBatch ? (
          <div className="space-y-4 pb-2">
            <div className="overflow-hidden rounded-3xl bg-white">
              <div className="divide-y divide-outline-variant/20">
                <OpeningDetailRow label="Status">
                  {batchStatus(detailBatch.status)}
                </OpeningDetailRow>
                <OpeningDetailRow label="Pengaju">{detailBatch.requestedByName}</OpeningDetailRow>
                <OpeningDetailRow label="Pemeriksa">
                  {detailBatch.approvedByName ?? "Belum ada"}
                </OpeningDetailRow>
                <OpeningDetailRow label="Alasan keputusan">
                  {detailBatch.decisionReason ??
                    detailBatch.rejectedReason ??
                    (detailBatch.status === "POSTED"
                      ? "Alasan keputusan belum tercatat pada data lama"
                      : "Belum diputus")}
                </OpeningDetailRow>
              </div>
            </div>
            {desktopSettings ? (
              <DesktopTable
                ariaLabel="Item saldo awal stok"
                columns={itemColumns}
                rows={settingsTablePageRows(detailBatch.items, itemColumns, itemTable)}
                rowKey={(item) => item.id}
                sortDescriptor={itemTable.sortDescriptor}
                onSortChange={itemTable.onSortChange}
                footer={
                  detailBatch.items.length > 10 ? (
                    <DesktopTablePagination
                      page={itemTable.page}
                      pageSize={itemTable.pageSize}
                      total={detailBatch.items.length}
                      onPageChange={itemTable.onPageChange}
                      onPageSizeChange={itemTable.onPageSizeChange}
                      ariaLabel="Halaman item saldo awal"
                    />
                  ) : undefined
                }
              />
            ) : (
              detailBatch.items.map((item) => (
                <div key={item.id} className="rounded-3xl bg-white px-4 py-3.5">
                  <p className="text-xs font-bold">{item.materialName}</p>
                  <p className="mt-0.5 text-meta text-on-surface-variant">{item.locationName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3 text-meta">
                    <span>
                      Jumlah fisik
                      <br />
                      <strong>
                        {item.quantity} {item.unit}
                      </strong>
                    </span>
                    <span className="text-right">
                      Harga per unit
                      <br />
                      <strong>Rp {item.unitCost.toLocaleString("id-ID")}</strong>
                    </span>
                    <span>
                      Subtotal
                      <br />
                      <strong>Rp {item.totalValue.toLocaleString("id-ID")}</strong>
                    </span>
                    <span className="text-right">
                      Biaya rata-rata
                      <br />
                      <strong>
                        {detailBatch.status === "POSTED"
                          ? `Rp ${item.averageCost.toLocaleString("id-ID")}`
                          : "Belum diposting"}
                      </strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </DetailSheet>
      <ConfirmationDialog
        open={simulationConfirmationBatch !== null}
        title="Masuk sebagai Finance Admin?"
        description="Session efektif akan berpindah sementara agar Anda dapat memeriksa saldo awal tanpa logout dari akun Owner."
        confirmLabel="Mulai simulasi"
        pending={simulationPending}
        onClose={() => {
          if (!simulationPending) setSimulationConfirmationBatch(null);
        }}
        onConfirm={confirmFinanceSimulation}
      >
        {financeTarget && simulationConfirmationBatch ? (
          <div className="divide-y divide-outline-variant/20 text-left">
            <div className="py-2 first:pt-0">
              <p className="text-eyebrow font-bold tracking-[0.12em] text-on-surface-variant uppercase">
                Akun efektif
              </p>
              <p className="mt-1 text-xs leading-4 font-bold text-on-surface">
                {financeTarget.name} · Finance Admin
              </p>
              <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                {financeTarget.email}
              </p>
            </div>
            <div className="py-2.5 last:pb-0">
              <p className="text-eyebrow font-bold tracking-[0.12em] text-on-surface-variant uppercase">
                Konsekuensi audit
              </p>
              <p className="mt-1 text-meta text-on-surface-variant">
                Keputusan untuk batch {simulationConfirmationBatch.batchNumber} tercatat atas
                identitas Finance ini. Anda dapat kembali ke Owner tanpa membuat keputusan.
              </p>
            </div>
          </div>
        ) : null}
      </ConfirmationDialog>
    </OnboardingStage>
  );
}
