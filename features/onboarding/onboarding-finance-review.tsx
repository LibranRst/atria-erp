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
          <span className="material-symbols-outlined text-success text-[34px]" aria-hidden="true">
            task_alt
          </span>
          <h1 className="text-on-surface mt-3 text-xl font-bold">Semua setup sudah diperiksa</h1>
          <p className="text-on-surface-variant mt-2 text-xs leading-5">
            Tidak ada saldo awal onboarding yang menunggu keputusan.
          </p>
          {simulated ? (
            <button
              type="button"
              disabled={pending}
              onClick={returnOwner}
              className="bg-primary text-on-primary mt-5 min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-45"
            >
              Kembali ke Owner
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.replace("/ledger")}
              className="bg-primary text-on-primary mt-5 min-h-12 w-full rounded-full px-5 text-xs font-bold"
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
        <p className="text-on-surface-variant text-[9px] font-bold tracking-[0.14em] uppercase">
          Onboarding Review
        </p>
        <h1 className="text-on-surface mt-1.5 text-[26px] font-bold tracking-[-0.035em]">
          Periksa saldo awal
        </h1>
        <p className="text-on-surface-variant mt-2 text-[12px] leading-5">
          Surface ini hanya memuat setup approval pending. Tidak ada editor budget, rekening, tim,
          atau margin Owner.
        </p>
      </header>
      <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/4">
        <div className="divide-outline-variant/20 divide-y">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-on-surface-variant text-xs font-semibold">Batch</span>
            <span className="text-on-surface text-xs font-bold">{active.batchNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-on-surface-variant text-xs font-semibold">Pengaju</span>
            <span className="text-on-surface text-xs font-bold">{active.requestedByName}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-on-surface-variant text-xs font-semibold">Dokumen sumber</span>
            <span className="text-on-surface max-w-[55%] text-right text-xs font-bold">
              {active.referenceNumber ?? "Tidak dilampirkan"}
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-on-surface-variant shrink-0 text-xs font-semibold">Total</span>
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
      <div className="rounded-[24px] bg-white p-4 ring-1 ring-black/4">
        <p className="text-on-surface text-xs font-bold">Dampak jika disetujui</p>
        <p className="text-on-surface-variant mt-1 text-[10px] leading-4">
          Mencatat pergerakan saldo awal stok, lalu mengisi stok fisik dan harga rata-rata. Kas,
          utang vendor, dan biaya aktual proyek tidak berubah.
        </p>
      </div>
      <div>
        <label
          htmlFor="onboarding-decision-reason"
          className="text-on-surface px-1 text-xs font-bold"
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
          className="text-error ring-error/15 min-h-12 rounded-full bg-white px-4 text-xs font-bold ring-1 disabled:opacity-40"
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={pending || reason.trim().length < 10}
          onClick={() => decide("APPROVE")}
          className="bg-primary text-on-primary min-h-12 rounded-full px-4 text-xs font-bold disabled:opacity-40"
        >
          Setujui & posting
        </button>
      </div>
      {simulated ? (
        <button
          type="button"
          disabled={pending}
          onClick={returnOwner}
          className="text-on-surface-variant min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-40"
        >
          Kembali ke Owner tanpa keputusan
        </button>
      ) : null}
    </section>
  );
}
