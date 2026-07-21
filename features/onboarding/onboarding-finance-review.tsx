"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  decideInventoryOpening,
  type InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { stopDeveloperAccountSimulation } from "@/app/actions/developer-account-simulation";
import { Textarea } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/inventory-opening-approval-items";

export function OnboardingFinanceReview({
  pendingBatches,
  simulated,
}: {
  readonly pendingBatches: readonly InventoryOpeningBatchView[];
  readonly simulated: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState<string | null>(pendingBatches[0]?.id ?? null);
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const active = pendingBatches.find((batch) => batch.id === activeId) ?? pendingBatches[0];

  function decide(decision: "APPROVE" | "REJECT"): void {
    if (!active || reason.trim().length < 10) {
      toast.error("Alasan keputusan wajib minimal 10 karakter.");
      return;
    }
    startTransition(async () => {
      const result = await decideInventoryOpening({
        batchId: active.id,
        decision,
        reason: reason.trim(),
        emergencyOverride: false,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        decision === "APPROVE"
          ? "Saldo awal diposting."
          : "Pengajuan ditolak dan dikembalikan ke Owner.",
      );
      setReason("");
      if (simulated) {
        const stopped = await stopDeveloperAccountSimulation({
          context: "ONBOARDING_SETUP_REVIEW",
        });
        if (!stopped.success) {
          toast.error(stopped.error.message);
          return;
        }
        router.replace("/onboarding?step=initial_stock");
      } else {
        setActiveId(null);
        router.refresh();
      }
    });
  }

  function returnOwner(): void {
    startTransition(async () => {
      const result = await stopDeveloperAccountSimulation({
        context: "ONBOARDING_SETUP_REVIEW",
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      router.replace("/onboarding?step=initial_stock");
      router.refresh();
    });
  }

  if (!active)
    return (
      <section className="w-full space-y-5 px-1">
        <div className="rounded-[28px] bg-white px-5 py-8 text-center ring-1 ring-black/4">
          <span className="material-symbols-outlined text-[34px] text-success" aria-hidden="true">
            task_alt
          </span>
          <h1 className="mt-3 text-xl font-bold text-on-surface">Semua setup sudah diperiksa</h1>
          <p className="mt-2 text-xs leading-5 text-on-surface-variant">
            Tidak ada saldo awal onboarding yang menunggu keputusan.
          </p>
          {simulated ? (
            <button
              type="button"
              disabled={pending}
              onClick={returnOwner}
              className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-45"
            >
              Kembali ke Owner
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.replace("/ledger")}
              className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary"
            >
              Masuk Dashboard
            </button>
          )}
        </div>
      </section>
    );

  const itemSource = { referenceId: active.id, inventoryItems: active.items };
  return (
    <section className="w-full space-y-5 px-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {simulated ? (
        <div className="rounded-[22px] bg-blue-50 px-4 py-3 text-[11px] leading-5 text-blue-800">
          <strong>Simulasi Finance Admin aktif.</strong> Keputusan tercatat menggunakan identitas
          Finance efektif dan tetap masuk audit.
        </div>
      ) : null}
      <header>
        <p className="text-[9px] font-bold tracking-[0.14em] text-on-surface-variant uppercase">
          Onboarding Review
        </p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.035em] text-on-surface">
          Periksa saldo awal
        </h1>
        <p className="mt-2 text-[12px] leading-5 text-on-surface-variant">
          Surface ini hanya memuat setup approval pending. Tidak ada editor budget, rekening, tim,
          atau margin Owner.
        </p>
      </header>
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/4">
        <div className="divide-y divide-outline-variant/20">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-xs font-semibold text-on-surface-variant">Batch</span>
            <span className="text-xs font-bold text-on-surface">{active.batchNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-xs font-semibold text-on-surface-variant">Pengaju</span>
            <span className="text-xs font-bold text-on-surface">{active.requestedByName}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-xs font-semibold text-on-surface-variant">Dokumen sumber</span>
            <span className="max-w-[55%] text-right text-xs font-bold text-on-surface">
              {active.referenceNumber ?? "Tidak dilampirkan"}
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5">
            <span className="shrink-0 text-xs font-semibold text-on-surface-variant">Total</span>
            <MoneyValue
              amount={active.totalValue}
              variant="fullDynamic"
              size="sm"
              align="right"
              className="min-w-0 flex-1"
            />
          </div>
        </div>
      </div>
      <InventoryOpeningApprovalItems item={itemSource} />
      <div className="rounded-3xl bg-white p-4 ring-1 ring-black/4">
        <p className="text-xs font-bold text-on-surface">Dampak jika disetujui</p>
        <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">
          Mencatat pergerakan saldo awal stok, lalu mengisi stok fisik dan harga rata-rata. Kas,
          utang vendor, dan biaya aktual proyek tidak berubah.
        </p>
      </div>
      <div>
        <label
          htmlFor="onboarding-decision-reason"
          className="px-1 text-xs font-bold text-on-surface"
        >
          Alasan keputusan
        </label>
        <Textarea
          id="onboarding-decision-reason"
          rows={3}
          value={reason}
          disabled={pending}
          onChange={setReason}
          placeholder="Minimal 10 karakter berdasarkan hasil pemeriksaan"
          className="mt-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={pending || reason.trim().length < 10}
          onClick={() => decide("REJECT")}
          className="min-h-12 rounded-full bg-white px-4 text-xs font-bold text-error ring-1 ring-error/15 disabled:opacity-40"
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={pending || reason.trim().length < 10}
          onClick={() => decide("APPROVE")}
          className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-40"
        >
          Setujui & posting
        </button>
      </div>
      {simulated ? (
        <button
          type="button"
          disabled={pending}
          onClick={returnOwner}
          className="min-h-12 w-full rounded-full px-5 text-xs font-bold text-on-surface-variant disabled:opacity-40"
        >
          Kembali ke Owner tanpa keputusan
        </button>
      ) : null}
    </section>
  );
}
