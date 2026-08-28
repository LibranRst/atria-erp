"use client";

import { useCan } from "@/components/auth/permissions-provider";
import { ApprovalControlManager } from "../budget/approval-control-manager";
import type { ApprovalThresholdSettings } from "@/server/usecases/settings/approval-thresholds";
import React from "react";

import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { SettingsOverview } from "@/app/actions/settings/system";
import type { AdministrationOverview, ProductionReadinessItem } from "@/app/actions/administration";
import type { OwnerOnboardingOverview } from "@atria/core/onboarding/owner-onboarding";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import Link from "next/link";
import { GroupedSurface, InlineStateRow } from "@/components/ui";
import { AdministrationManager } from "@/features/administration/components/workspaces/administration-manager";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { BudgetSettingsManager } from "../budget/budget-settings-manager";
import { CatalogSettingsManager } from "../catalog/catalog-settings-manager";
import { SettingsNavigation } from "./settings-navigation";
import { SettingsHeader } from "../shared/settings-ui";
import {
  parseSettingsTab,
  settingsTabUrl,
  type SettingsTab,
} from "../../utils/settings-tabs-config";

function ModuleUnavailableState({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <GroupedSurface>
      <InlineStateRow icon="lock" title={title} description={description} />
    </GroupedSurface>
  );
}

type SettingsDashboardProps = {
  readonly overview: SettingsOverview;
  readonly pricingTemplates: readonly PricingTemplateRow[];
  readonly initialTab?: SettingsTab;
  readonly administration: AdministrationOverview | null;
  readonly readiness: readonly ProductionReadinessItem[];
  readonly onboarding: OwnerOnboardingOverview | null;
  readonly initialStock: readonly InitialStockCandidate[];
  readonly openingBatches: readonly InventoryOpeningBatchView[];
  readonly approvalThresholds: ApprovalThresholdSettings | null;
};

export function SettingsDashboard({
  initialTab = "financial",
  overview,
  pricingTemplates,
  administration,
  onboarding,
  approvalThresholds,
}: SettingsDashboardProps): React.JSX.Element {
  const can = useCan();
  const tabParam = useBrowserUrlSearchParam("tab", initialTab === "financial" ? null : initialTab);
  const activeTab = tabParam ? parseSettingsTab(tabParam) : initialTab;

  function changeTab(tab: SettingsTab): void {
    updateBrowserUrl(settingsTabUrl(tab), "replace");
  }

  const showOnboardingBanner = onboarding && onboarding.state.status !== "COMPLETED";
  const setupSteps = onboarding
    ? onboarding.readiness.filter((item) => item.id !== "welcome" && item.id !== "summary")
    : [];
  const completedSteps = setupSteps.filter((item) => item.ready).length;
  const setupProgress =
    setupSteps.length > 0 ? Math.round((completedSteps / setupSteps.length) * 100) : 0;

  let content: React.JSX.Element;

  if (activeTab === "organization") {
    content = administration ? (
      <AdministrationManager initialData={administration} presentation="settings" />
    ) : (
      <ModuleUnavailableState
        title="Akses administrasi dibatasi"
        description="Tim dan vendor hanya dapat dikelola oleh role dengan izin administrasi."
      />
    );
  } else if (activeTab === "catalog") {
    content = (
      <CatalogSettingsManager
        initialMaterials={overview.materials}
        initialCategories={overview.materialCategories}
        pricingTemplates={pricingTemplates}
        expenseCategories={overview.expenseCategories}
        vendors={overview.vendors}
        locations={overview.inventoryLocations}
        canManageMaterials={overview.permissions.canManageMaterialSettings}
        canManageLibrary={overview.permissions.canManageItemLibrary}
      />
    );
  } else {
    content = overview.budgetAllocationSetting ? (
      <div className="space-y-sm">
        <BudgetSettingsManager
          initialSetting={overview.budgetAllocationSetting}
          initialCategories={overview.expenseCategories}
          canManage={overview.permissions.canManageBudgetSettings}
        />
        {approvalThresholds ? (
          <ApprovalControlManager
            fieldCostCents={approvalThresholds.fieldCostCents}
            vendorPaymentCents={approvalThresholds.vendorPaymentCents}
            canManage={can("manage:approval_settings")}
          />
        ) : null}
      </div>
    ) : (
      <ModuleUnavailableState
        title="Default budget belum tersedia"
        description="Buat default alokasi budget terlebih dahulu sebelum mengaturnya di sini."
      />
    );
  }

  return (
    <section className="min-w-0 space-y-sm pb-8 max-[430px]:-mx-1 max-[430px]:pb-6">
      <SettingsHeader
        title="Pengaturan"
        description="Konfigurasi default finansial, master data katalog, dan akses organisasi."
        role={overview.roleName}
      />

      {showOnboardingBanner && onboarding ? (
        <div className="flex items-center justify-between gap-3 rounded-owner bg-surface-inverse px-4 py-3 text-white shadow-inverse ring-1 ring-white/8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-bold text-white">
                Kesiapan Setup Organisasi ({setupProgress}%)
              </span>
              <span className="font-mono text-[10px] text-white/60">
                {completedSteps}/{setupSteps.length} langkah
              </span>
            </div>
            <div
              className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-label="Kemajuan setup organisasi"
              aria-valuenow={completedSteps}
              aria-valuemin={0}
              aria-valuemax={setupSteps.length}
            >
              <div
                className="rounded-full bg-accent transition-all duration-300"
                style={{ width: `${setupProgress}%` }}
              />
            </div>
          </div>
          <Link
            href={`/onboarding?step=${onboarding.state.currentStep}`}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-white/90"
          >
            Lanjutkan
          </Link>
        </div>
      ) : null}

      <SettingsNavigation
        value={activeTab}
        onChange={changeTab}
        showAdministration={Boolean(administration)}
      />

      <div className="min-w-0">{content}</div>
    </section>
  );
}
