"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";

import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { OpeningInventoryWorkspace } from "@/features/materials/components/opening-inventory-workspace";
import type {
  OnboardingStepStatus,
  OwnerOnboardingOverview,
} from "@/lib/onboarding/owner-onboarding";
import {
  SettingsGroupSurface,
  SettingsModuleHeader,
  SettingsRowChevron,
  SettingsStatusLabel,
} from "./settings-primitives";

function tone(status: OnboardingStepStatus): "positive" | "inactive" | "neutral" {
  if (status === "READY" || status === "NOT_APPLICABLE") return "positive";
  if (status === "PENDING_APPROVAL" || status === "REVIEWED") return "neutral";
  return "inactive";
}

function label(status: OnboardingStepStatus): string {
  if (status === "READY") return "Siap";
  if (status === "PENDING_APPROVAL") return "Pending";
  if (status === "NOT_APPLICABLE") return "Tidak perlu";
  if (status === "SKIPPED") return "Ditunda";
  if (status === "REVIEWED") return "Ditinjau";
  return "Lengkapi";
}

export function SetupReadinessManager({
  overview,
  inventory,
  batches,
}: {
  readonly overview: OwnerOnboardingOverview;
  readonly inventory: readonly InitialStockCandidate[];
  readonly batches: readonly InventoryOpeningBatchView[];
}): React.JSX.Element {
  const searchParams = useSearchParams();
  const showInitialStock = searchParams.get("flow") === "initial-stock";
  const legacyReview = !overview.hasPersistedState && !overview.freshInstall;
  if (showInitialStock) {
    return (
      <section className="space-y-4">
        <Link
          href="/settings?tab=setup"
          className="inline-flex min-h-12 items-center gap-1 rounded-full px-2 text-[10px] font-bold text-[#007AFF]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          Kembali ke kesiapan setup
        </Link>
        <OpeningInventoryWorkspace inventory={inventory} batches={batches} embedded />
      </section>
    );
  }

  const missing = overview.readiness.filter((item) => !item.ready && item.id !== "summary").length;
  return (
    <section className="space-y-5">
      <SettingsModuleHeader
        eyebrow="Fondasi operasional"
        title="Kesiapan setup"
        description="Status berasal dari data nyata. Menyelesaikan onboarding tidak menyembunyikan konfigurasi yang masih kosong."
      />
      <section className="rounded-[26px] bg-[#151719] p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[9px] font-bold tracking-[0.13em] text-white/50 uppercase">
              Status onboarding
            </span>
            <span className="mt-2 block text-[22px] font-bold tracking-[-0.03em]">
              {legacyReview
                ? "Review setup tersedia"
                : overview.state.status === "COMPLETED"
                  ? "Sudah diselesaikan"
                  : overview.state.status === "PAUSED"
                    ? "Sedang dijeda"
                    : "Sedang berjalan"}
            </span>
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-bold text-white/75">
            {missing} gap
          </span>
        </div>
        {overview.canManageOnboarding ? (
          <Link
            href={`/onboarding?step=${overview.state.currentStep}`}
            className="text-primary mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-xs font-bold"
          >
            {legacyReview
              ? "Mulai review setup"
              : overview.state.status === "COMPLETED"
                ? "Review setup"
                : "Lanjutkan onboarding"}
          </Link>
        ) : (
          <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-4 text-white/55">
            Progress onboarding hanya dapat diubah Owner. Aksi material tetap mengikuti permission
            role Anda.
          </p>
        )}
      </section>
      <SettingsGroupSurface>
        <div className="divide-y divide-black/5.5">
          {overview.readiness
            .filter((item) => item.id !== "summary")
            .map((item) => {
              const settingsHref =
                item.id === "financial_defaults"
                  ? "/settings?tab=budget"
                  : item.id === "team_vendors"
                    ? "/settings?tab=administration"
                    : item.id === "bank_accounts"
                      ? "/ledger?tab=accounts"
                      : item.id === "material_foundation"
                        ? "/settings?tab=materials"
                        : item.id === "item_library"
                          ? "/settings?tab=library"
                          : item.id === "initial_stock"
                            ? "/settings?tab=setup&flow=initial-stock"
                            : "/settings?tab=setup";
              const href =
                item.id === "initial_stock"
                  ? settingsHref
                  : overview.canManageOnboarding
                    ? item.href
                    : settingsHref;
              return (
                <Link
                  key={item.id}
                  href={href}
                  className="active:bg-surface-container-low focus-visible:bg-surface-container-low flex min-h-[72px] items-center gap-3 px-3.5 py-3 outline-none"
                >
                  <span
                    className={`material-symbols-outlined flex! h-9 w-9 shrink-0 items-center justify-center rounded-[13px] text-[18px] ${item.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    aria-hidden="true"
                  >
                    {item.ready
                      ? "check"
                      : item.status === "PENDING_APPROVAL"
                        ? "hourglass_top"
                        : "priority_high"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-on-surface block text-[13px] font-bold">
                      {item.label}
                    </span>
                    <span className="text-on-surface-variant mt-0.5 block text-[10px] leading-4">
                      {item.detail}
                    </span>
                  </span>
                  <SettingsStatusLabel label={label(item.status)} tone={tone(item.status)} />
                  <SettingsRowChevron />
                </Link>
              );
            })}
        </div>
      </SettingsGroupSurface>
    </section>
  );
}
