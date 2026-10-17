"use client";

import React from "react";

import { AppIcon, ButtonLink, GroupedSurface, StatusBadge } from "@/components/ui";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

export function OrganizationSetupCard({
  overview,
  density,
}: {
  readonly overview: OrganizationSetupOverview;
  readonly density: "dashboard" | "settings";
}): React.JSX.Element | null {
  const compactDesktop = useWorkspacePresentation() === "desktop" && density === "settings";
  const quickStartIncomplete = overview.quickStart.state.status !== "COMPLETED";
  const setupFullyReady = !quickStartIncomplete && overview.allRequiredReady;
  const missing = overview.requiredTotal - overview.requiredReadyCount;
  if (setupFullyReady) return null;

  const items = quickStartIncomplete
    ? Array.from({ length: overview.quickStart.progress.total }, (_, index) => ({
        id: `quick-${index}`,
        ready: overview.quickStart.progress.current > index + 1,
        active: overview.quickStart.progress.current === index + 1,
      }))
    : overview.requiredReadiness.map((item) => ({
        id: item.id,
        ready: item.ready,
        active: !item.ready,
      }));
  const title = quickStartIncomplete
    ? !overview.canManageQuickStart
      ? "Quick start menunggu Owner"
      : overview.quickStart.state.status === "PAUSED"
        ? "Quick start dijeda"
        : "Lanjutkan project pertama"
    : overview.allRequiredReady
      ? "Fondasi operasional siap"
      : `${missing} fondasi wajib tersisa`;
  const detail = quickStartIncomplete
    ? !overview.canManageQuickStart
      ? "Anda tetap dapat melihat task kesiapan yang sesuai dengan peran Anda."
      : `Tahap aktif: ${overview.quickStart.state.currentStep === "financial_defaults" ? "Default finansial" : overview.quickStart.state.currentStep === "first_project" ? "Project pertama" : "Pengenalan"}`
    : overview.allRequiredReady
      ? "Tim, rekening, material, dan saldo awal sudah siap."
      : "Lengkapi sesuai peran tanpa menghambat perencanaan project Draft.";
  const href =
    quickStartIncomplete && overview.canManageQuickStart
      ? "/onboarding"
      : "/settings?tab=readiness";
  const actionLabel =
    quickStartIncomplete && overview.canManageQuickStart
      ? "Lanjutkan"
      : overview.allRequiredReady
        ? "Review"
        : "Lihat checklist";
  const current = quickStartIncomplete
    ? overview.quickStart.progress.current
    : overview.requiredReadyCount;
  const total = quickStartIncomplete ? overview.quickStart.progress.total : overview.requiredTotal;

  return (
    <GroupedSurface as="section" variant={compactDesktop ? "desktopPanel" : "default"}>
      <div
        className={
          compactDesktop
            ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3"
            : density === "dashboard"
              ? "space-y-3 p-4"
              : "space-y-3 p-3.5"
        }
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex shrink-0 items-center justify-center bg-surface-container-low text-on-surface ${compactDesktop ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-icon"}`}
          >
            <AppIcon name={setupFullyReady ? "verified" : "task_alt"} className="icon-lg" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-row font-semibold text-on-surface">{title}</span>
              {setupFullyReady ? <StatusBadge tone="completed" label="Siap" /> : null}
            </span>
            <span className="mt-0.5 block text-meta text-on-surface-variant">{detail}</span>
          </span>
        </div>

        <div
          className={compactDesktop ? "hidden" : "flex gap-1.5"}
          role="progressbar"
          aria-label={quickStartIncomplete ? "Kemajuan quick start" : "Kesiapan operasional"}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
          aria-valuetext={
            quickStartIncomplete
              ? `${current} dari ${total} tahap perjalanan quick start`
              : `${current} dari ${total} fondasi wajib siap`
          }
        >
          {items.map((item) => (
            <span
              key={item.id}
              aria-hidden="true"
              className={`h-2.5 flex-1 rounded-full ${
                item.ready
                  ? "bg-primary"
                  : item.active
                    ? "bg-accent-container ring-1 ring-accent/20"
                    : "bg-surface-container-high"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span
            className={
              compactDesktop ? "hidden" : "text-meta font-semibold text-on-surface-variant"
            }
          >
            {current}/{total} {quickStartIncomplete ? "tahap" : "wajib"}
          </span>
          <ButtonLink href={href} variant="secondary" size="compact">
            {actionLabel}
          </ButtonLink>
        </div>
      </div>
    </GroupedSurface>
  );
}
