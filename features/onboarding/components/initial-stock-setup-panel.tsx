"use client";

import React from "react";
import { toast } from "sonner";

import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { BottomSheet, ConfirmationSheet } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { OpeningInventoryWorkspace } from "@/features/materials/components/opening-inventory-workspace";
import { OnboardingFinanceReview } from "@/features/onboarding/onboarding-finance-review";
import { startDeveloperAccountSimulation } from "@/app/actions/developer-account-simulation";
import type { DeveloperAccountSimulationState } from "@/lib/auth/developer-account-simulation";
import { OnboardingNotice, OnboardingStage, OnboardingSurface } from "./onboarding-primitives";

function batchStatus(status: string): string {
  if (status === "PENDING_APPROVAL") return "Menunggu persetujuan";
  if (status === "POSTED") return "Sudah diposting";
  if (status === "REJECTED") return "Ditolak";
  if (status === "REVERSED") return "Sudah dibalik";
  return status;
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
      <strong className="min-w-0 flex-1 text-right leading-5 font-bold wrap-anywhere wrap-break-word text-on-surface">
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
}: {
  readonly candidates: readonly InitialStockCandidate[];
  readonly batches: readonly InventoryOpeningBatchView[];
  readonly onMutationComplete: () => void;
  readonly onNoLegacyStock: () => void;
  readonly onSkip: () => void;
  readonly simulation: DeveloperAccountSimulationState | null;
}): React.JSX.Element {
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [detailBatch, setDetailBatch] = React.useState<InventoryOpeningBatchView | null>(null);
  const [simulationBatch, setSimulationBatch] = React.useState<InventoryOpeningBatchView | null>(
    null,
  );
  const [simulationConfirmationBatch, setSimulationConfirmationBatch] =
    React.useState<InventoryOpeningBatchView | null>(null);
  const [simulationPending, startSimulationTransition] = React.useTransition();
  const eligible = candidates.filter((row) => row.eligible).length;
  const financeTarget = simulation?.onboardingReviewTargets?.[0];

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
      <OnboardingSurface>
        <div className="divide-y divide-black/5.5">
          <button
            type="button"
            onClick={onNoLegacyStock}
            className="flex min-h-16.5 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
          >
            <span
              className="material-symbols-outlined flex! h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-success/9 text-[18px] text-success"
              aria-hidden="true"
            >
              check
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] leading-5 font-bold text-on-surface">
                Tidak ada stok lama
              </span>
              <span className="block text-[9px] leading-4 text-on-surface-variant">
                Mulai inventory dari nol.
              </span>
            </span>
            <span
              className="material-symbols-outlined text-[17px] text-on-surface-variant/55"
              aria-hidden="true"
            >
              chevron_right
            </span>
          </button>
          <button
            type="button"
            disabled={eligible === 0}
            onClick={() => setComposerOpen(true)}
            className="flex min-h-16.5 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low disabled:opacity-40"
          >
            <span
              className="material-symbols-outlined flex! h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#007AFF]/8 text-[18px] text-[#007AFF]"
              aria-hidden="true"
            >
              inventory
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] leading-5 font-bold text-on-surface">
                Ada stok lama
              </span>
              <span className="block text-[9px] leading-4 text-on-surface-variant">
                Catat manual atau import CSV.
              </span>
            </span>
            <span
              className="material-symbols-outlined text-[17px] text-on-surface-variant/55"
              aria-hidden="true"
            >
              chevron_right
            </span>
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex min-h-16.5 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
          >
            <span
              className="material-symbols-outlined flex! h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-[18px] text-on-surface-variant"
              aria-hidden="true"
            >
              schedule
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] leading-5 font-bold text-on-surface">
                Isi nanti
              </span>
              <span className="block text-[9px] leading-4 text-on-surface-variant">
                Tetap tercatat sebagai gap setup.
              </span>
            </span>
            <span
              className="material-symbols-outlined text-[17px] text-on-surface-variant/55"
              aria-hidden="true"
            >
              chevron_right
            </span>
          </button>
        </div>
      </OnboardingSurface>
      {batches.length > 0 ? (
        <OnboardingSurface>
          <div className="divide-y divide-black/5.5">
            {batches.map((batch) => (
              <div key={batch.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setDetailBatch(batch)}
                  className="flex min-h-13 w-full items-center gap-3 text-left"
                >
                  <span
                    className="material-symbols-outlined flex! h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-[18px] text-on-surface-variant"
                    aria-hidden="true"
                  >
                    inventory
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] leading-5 font-bold text-on-surface">
                      {batch.batchNumber}
                    </span>
                    <span className="block text-[9px] leading-4 text-on-surface-variant">
                      {batch.itemCount} item · {batchStatus(batch.status)}
                    </span>
                  </span>
                  <MoneyValue
                    amount={batch.totalValue}
                    variant="compactWithFull"
                    size="sm"
                    align="right"
                  />
                  <span
                    className="material-symbols-outlined text-[18px] text-on-surface-variant"
                    aria-hidden="true"
                  >
                    chevron_right
                  </span>
                </button>
                {batch.status === "PENDING_APPROVAL" && simulation?.enabled && financeTarget ? (
                  <button
                    type="button"
                    disabled={simulationPending}
                    onClick={() => setSimulationConfirmationBatch(batch)}
                    className="mt-2 min-h-12 w-full rounded-full bg-blue-50 px-4 text-[10px] font-bold text-blue-700 disabled:opacity-40"
                  >
                    Simulasikan Finance Admin
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </OnboardingSurface>
      ) : null}
      {eligible === 0 ? (
        <OnboardingNotice icon="lock" tone="warning">
          Belum ada inventory saldo nol yang memenuhi syarat. Lengkapi lokasi dan Material Master
          lebih dahulu.
        </OnboardingNotice>
      ) : (
        <OnboardingNotice icon="verified_user">
          Setelah diajukan, stok tetap nol sampai Finance Admin atau Owner lain menyetujuinya.
        </OnboardingNotice>
      )}
      <BottomSheet
        open={composerOpen}
        title="Catat saldo awal stok"
        initialExpanded
        onClose={() => setComposerOpen(false)}
      >
        <OpeningInventoryWorkspace
          inventory={candidates}
          batches={batches}
          embedded
          showHeader={false}
          showHistory={false}
          setupOnly
          onMutationComplete={() => {
            setComposerOpen(false);
            onMutationComplete();
          }}
        />
      </BottomSheet>
      <BottomSheet
        open={detailBatch !== null}
        title="Detail saldo awal"
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
                <OpeningDetailRow label="Checker">
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
            {detailBatch.items.map((item) => (
              <div key={item.id} className="rounded-3xl bg-white px-4 py-3.5">
                <p className="text-xs font-bold">{item.materialName}</p>
                <p className="mt-0.5 text-[10px] text-on-surface-variant">{item.locationName}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3 text-[10px]">
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
            ))}
          </div>
        ) : null}
      </BottomSheet>
      <ConfirmationSheet
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
              <p className="text-[9px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">
                Akun efektif
              </p>
              <p className="mt-1 text-xs leading-4 font-bold text-on-surface">
                {financeTarget.name} · Finance Admin
              </p>
              <p className="mt-0.5 truncate text-[10px] leading-4 text-on-surface-variant">
                {financeTarget.email}
              </p>
            </div>
            <div className="py-2.5 last:pb-0">
              <p className="text-[9px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">
                Konsekuensi audit
              </p>
              <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">
                Keputusan untuk batch {simulationConfirmationBatch.batchNumber} tercatat atas
                identitas Finance ini. Anda dapat kembali ke Owner tanpa membuat keputusan.
              </p>
            </div>
          </div>
        ) : null}
      </ConfirmationSheet>
    </OnboardingStage>
  );
}
