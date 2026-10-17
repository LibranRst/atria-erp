"use client";

import { useRouter } from "@/lib/navigation/workspace-navigation";

import Link from "@/lib/navigation/workspace-link";
import React from "react";
import { toast } from "sonner";

import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { setInitialStockReadinessDecision } from "@/app/actions/quick-start";
import {
  AppIcon,
  type AppIconName,
  GroupedSurface,
  IconButtonLink,
  PageState,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";
import { InitialStockSetupPanel } from "@/features/onboarding/components/panels/initial-stock-setup-panel";
import type {
  OperationalReadinessItem,
  OrganizationSetupOverview,
} from "@atria/core/onboarding/organization-setup";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { SettingsReadSources } from "@atria/core/settings/read-sources";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";

function getReadinessIcon(id: string): AppIconName {
  switch (id) {
    case "core_team":
      return "group";
    case "bank_account":
      return "account_balance";
    case "material_foundation":
      return "inventory";
    case "initial_stock":
      return "archive";
    case "vendor":
      return "handshake";
    case "item_library":
      return "category";
    default:
      return "fact_check";
  }
}

function ReadinessRow({
  item,
  desktop,
}: {
  readonly item: OperationalReadinessItem;
  readonly desktop: boolean;
}): React.JSX.Element {
  const iconName = getReadinessIcon(item.id);
  const statusLabel = item.ready
    ? item.status === "NOT_APPLICABLE"
      ? "Tidak perlu"
      : "Siap"
    : item.status === "PENDING_APPROVAL"
      ? "Menunggu"
      : "Lengkapi";

  const statusTone = item.ready
    ? item.status === "NOT_APPLICABLE"
      ? "neutral"
      : "positive"
    : item.status === "PENDING_APPROVAL"
      ? "warning"
      : "critical";

  const content = (
    <div
      className={
        desktop
          ? "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
          : "flex min-h-18 w-full items-center gap-3 px-3.5 py-3 text-left"
      }
    >
      <span
        className={`flex shrink-0 items-center justify-center bg-surface-container-low text-on-surface-variant ${desktop ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-icon"}`}
        aria-hidden="true"
      >
        <AppIcon name={iconName} className="icon-md" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-row font-semibold text-on-surface">{item.label}</span>
        <span
          className={
            desktop
              ? "mt-0.5 block text-support text-on-surface-variant"
              : "block truncate text-meta text-on-surface-variant"
          }
        >
          {item.detail}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <WorkspaceStatusLabel label={statusLabel} tone={statusTone} />
        {item.action ? <WorkspaceRowChevron /> : null}
      </div>
    </div>
  );

  return item.action ? (
    <Link
      href={item.action.href}
      className="block w-full text-left transition-colors outline-none hover:bg-surface-container-low/50 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low/70"
      aria-label={`${item.action.label}: ${item.label}`}
    >
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}

export function SetupReadinessManager({
  overview,
  inventory,
  batches,
  sources,
}: {
  readonly overview: OrganizationSetupOverview;
  readonly inventory: readonly InitialStockCandidate[];
  readonly batches: readonly InventoryOpeningBatchView[];
  readonly sources?: SettingsReadSources;
}): React.JSX.Element {
  const router = useRouter();
  const desktop = useWorkspacePresentation() === "desktop";
  const [pending, startTransition] = React.useTransition();
  const showInitialStock = useBrowserUrlSearchParam("flow") === "initial-stock";

  function decide(decision: "NO_LEGACY_STOCK" | "SKIPPED"): void {
    startTransition(async () => {
      const result = await setInitialStockReadinessDecision({ decision });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        decision === "NO_LEGACY_STOCK"
          ? "Keputusan tanpa stok lama tersimpan."
          : "Saldo awal dapat dilengkapi nanti.",
      );
      router.refresh();
    });
  }

  if (showInitialStock) {
    const failed = sources
      ? [sources.initialStock, sources.openingBatches].find((source) => source.status !== "ready")
      : undefined;
    return (
      <section className="min-w-0 space-y-4">
        <header className="flex items-center gap-3">
          <IconButtonLink
            href="/settings?tab=readiness"
            label="Kembali ke kesiapan"
            variant="secondary"
            size="default"
            className="shrink-0"
          >
            <AppIcon name="arrow_back" className="icon-md" />
          </IconButtonLink>
          <div className="min-w-0 flex-1">
            <p
              className={
                desktop
                  ? "hidden"
                  : "text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase"
              }
            >
              Kesiapan operasional
            </p>
            <h1 className="text-lg font-bold tracking-tight text-on-surface">Saldo awal stok</h1>
          </div>
        </header>
        <p className="text-support text-on-surface-variant">
          Finalkan posisi stok fisik yang sudah dimiliki sebelum operasi inventory Paduna Build
          berjalan.
        </p>

        {failed ? (
          <PageState
            kind={
              failed.status === "restricted" || failed.status === "unauthorized"
                ? "restricted"
                : "error"
            }
            title="Saldo awal stok belum dapat dimuat"
            description={
              "message" in failed
                ? failed.message
                : "Muat ulang untuk membaca stok dan pengajuan yang tersedia."
            }
            actionLabel={
              failed.status === "restricted" || failed.status === "unauthorized"
                ? undefined
                : "Coba lagi"
            }
            onAction={() => router.refresh()}
            compact
          />
        ) : (
          <InitialStockSetupPanel
            presentation="settings"
            candidates={inventory}
            batches={batches}
            simulation={null}
            pending={pending}
            onMutationComplete={() => router.refresh()}
            onNoLegacyStock={() => decide("NO_LEGACY_STOCK")}
            onSkip={() => decide("SKIPPED")}
          />
        )}
        {pending ? (
          <p className="text-center text-meta text-on-surface-variant">Menyimpan keputusan…</p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={desktop ? "grid min-w-0 items-start gap-4 lg:grid-cols-2" : "min-w-0 space-y-sm"}
    >
      <section className="space-y-2">
        <div className="flex min-h-8 items-center justify-between gap-3 px-1">
          <h3 className="text-section font-bold text-on-surface">Fondasi utama</h3>
          <span className="text-meta font-semibold text-on-surface-variant">
            {overview.requiredReadyCount} aktif dari {overview.requiredTotal}
          </span>
        </div>
        <GroupedSurface variant={desktop ? "desktopPanel" : "default"}>
          <div className="divide-y divide-outline-variant/20">
            {overview.requiredReadiness.map((item) => (
              <ReadinessRow key={item.id} item={item} desktop={desktop} />
            ))}
          </div>
        </GroupedSurface>
      </section>

      <section className="space-y-2">
        <div className="flex min-h-8 items-center justify-between gap-3 px-1">
          <h3 className="text-section font-bold text-on-surface">Katalog & pendukung</h3>
          <span className="text-meta font-semibold text-on-surface-variant">
            Opsional untuk RAP & RAB
          </span>
        </div>
        <GroupedSurface variant={desktop ? "desktopPanel" : "default"}>
          <div className="divide-y divide-outline-variant/20">
            {overview.recommendedReadiness.map((item) => (
              <ReadinessRow key={item.id} item={item} desktop={desktop} />
            ))}
          </div>
        </GroupedSurface>
      </section>
    </section>
  );
}
