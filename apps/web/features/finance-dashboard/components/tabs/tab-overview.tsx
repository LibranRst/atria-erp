"use client";

import React from "react";
import Link from "next/link";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import type { OwnerOnboardingOverview } from "@atria/core/onboarding/owner-onboarding";
import { RowGroup } from "@/components/ui";
import { OverviewPreviewSection } from "@/features/finance-dashboard/components/shared/dashboard-primitives";
import {
  OverviewCashRows,
  OverviewPreviewEmpty,
  OverviewPriorityList,
} from "@/features/finance-dashboard/components/cards/dashboard-cards";
import { ProjectRiskRow } from "@/features/finance-dashboard/components/rows/project-rows";
import { CashDueRow } from "@/features/finance-dashboard/components/rows/cash-due-rows";
import { MaterialIssueRow } from "@/features/finance-dashboard/components/rows/material-rows";

export function DashboardOverviewTab({
  data,
  financialPosition,
  onboarding,
}: {
  readonly data: FinanceDashboardOverview;
  readonly financialPosition: React.ReactNode;
  readonly onboarding: OwnerOnboardingOverview | null;
}): React.JSX.Element {
  const nextDue = data.dashboardDetails.cashDueGroups.flatMap((group) => group.items).slice(0, 3);
  const materialAttention = data.dashboardDetails.materials
    .filter((item) => item.severity !== "INFO")
    .slice(0, 3);
  const showOnboardingCard = onboarding && onboarding.state.status !== "COMPLETED";
  const setupSteps = onboarding
    ? onboarding.readiness.filter((item) => item.id !== "welcome" && item.id !== "summary")
    : [];
  const completedSteps = setupSteps.filter((item) => item.ready).length;
  const missingSteps = setupSteps.length - completedSteps;
  const setupProgress =
    setupSteps.length > 0 ? Math.round((completedSteps / setupSteps.length) * 100) : 0;
  const activeStepItem = onboarding
    ? onboarding.readiness.find((item) => item.id === onboarding.state.currentStep)
    : null;

  return (
    <div className="space-y-sm">
      {showOnboardingCard && onboarding ? (
        <section className="flex flex-col gap-2 rounded-owner bg-surface-inverse p-2 text-white shadow-inverse ring-1 ring-white/8 max-[430px]:p-4">
          <div className="flex flex-col gap-2 rounded-inset bg-white/8 p-3">
            <div className="min-w-0">
              <span className="block text-base leading-5 font-bold tracking-[-0.02em] text-white">
                {onboarding.state.status === "PAUSED"
                  ? `${missingSteps} langkah tersisa`
                  : "Mulai setup organisasi"}
              </span>
              <div className="flex items-center justify-between gap-3 text-[10px] leading-5 text-white/52">
                <span className="truncate">
                  Langkah aktif:{" "}
                  <span className="font-bold text-white/85">{activeStepItem?.label}</span>
                </span>
              </div>
            </div>

            <div
              className="flex gap-1.5"
              role="progressbar"
              aria-label="Kemajuan setup organisasi"
              aria-valuemin={0}
              aria-valuemax={setupSteps.length}
              aria-valuenow={completedSteps}
              aria-valuetext={`${completedSteps} dari ${setupSteps.length} langkah setup selesai (${setupProgress} persen)`}
            >
              {setupSteps.map((stepItem) => {
                const isCompleted = stepItem.ready;
                const isActive = onboarding.state.currentStep === stepItem.id;
                let bgClass = "bg-white/10";
                if (isCompleted) {
                  bgClass = "bg-accent";
                } else if (isActive) {
                  bgClass = "bg-white/90 ring-1 ring-white/35";
                }
                return (
                  <div
                    key={stepItem.id}
                    className={`h-2.5 flex-1 rounded-full ${bgClass}`}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-row items-center justify-end gap-4 px-1 py-1">
            <span className="font-mono text-eyebrow font-semibold text-white/70">
              {completedSteps}/{setupSteps.length} selesai · {setupProgress}%
            </span>
            <Link
              href={`/onboarding?step=${onboarding.state.currentStep}`}
              className="flex w-fit items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-bold text-primary"
            >
              Lanjutkan setup
            </Link>
          </div>
        </section>
      ) : null}

      {financialPosition}
      <OverviewPreviewSection
        title={data.role === "OWNER" ? "Perlu keputusan" : "Prioritas finance"}
        href={data.role === "OWNER" ? "/ledger?tab=approvals" : "/ledger?tab=cash"}
      >
        {data.actions.length === 0 ? (
          <OverviewPreviewEmpty>
            Tidak ada tindakan mendesak. Kondisi utama sudah terkendali.
          </OverviewPreviewEmpty>
        ) : (
          <OverviewPriorityList actions={data.actions} />
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Budget berisiko" href="/ledger?tab=budget">
        {data.riskyProjects.length === 0 ? (
          <OverviewPreviewEmpty>Semua project aktif masih dalam batas budget.</OverviewPreviewEmpty>
        ) : (
          <RowGroup>
            {data.riskyProjects.slice(0, 3).map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} compact />
            ))}
          </RowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Jatuh tempo terdekat" href="/ledger?tab=cash">
        {nextDue.length === 0 ? (
          <OverviewPreviewEmpty>Tidak ada tagihan atau invoice terbuka.</OverviewPreviewEmpty>
        ) : (
          <RowGroup connected>
            {nextDue.map((item) => (
              <CashDueRow
                key={`${item.type}-${item.id}`}
                item={item}
                referenceDate={new Date(data.generatedAt)}
                compact
              />
            ))}
          </RowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Perhatian material" href="/ledger?tab=materials">
        {materialAttention.length === 0 ? (
          <OverviewPreviewEmpty>Tidak ada masalah material aktif.</OverviewPreviewEmpty>
        ) : (
          <RowGroup>
            {materialAttention.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Perubahan kas terbaru" href="/ledger?tab=accounts">
        {data.recentTransactions.length === 0 ? (
          <OverviewPreviewEmpty>Belum ada transaksi kas.</OverviewPreviewEmpty>
        ) : (
          <OverviewCashRows transactions={data.recentTransactions.slice(0, 3)} />
        )}
      </OverviewPreviewSection>
    </div>
  );
}
