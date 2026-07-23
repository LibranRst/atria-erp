"use client";

import React from "react";

import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { SettingsHubOverview, SettingsOverview } from "@/app/actions/settings/system";
import type { AdministrationOverview, ProductionReadinessItem } from "@/app/actions/administration";
import type { OwnerOnboardingOverview } from "@/lib/onboarding/owner-onboarding";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { AdministrationManager } from "@/features/administration/components/workspaces/administration-manager";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { BudgetSettingsManager } from "../budget/budget-settings-manager";
import { CategorySettingsManager } from "../categories/category-settings-manager";
import { LibrarySettingsManager } from "../library/library-settings-manager";
import { MaterialSettingsManager } from "../materials/material-settings-manager";
import { SettingsHub } from "./settings-hub";
import { SettingsNavigation } from "./settings-navigation";
import { SettingsHeader } from "../shared/settings-ui";
import { SetupReadinessManager } from "../shared/setup-readiness-manager";
import { parseSettingsTab, settingsTabUrl, type SettingsTab } from "../../utils/settings-tabs-config";

type SettingsDashboardProps = {
  readonly overview: SettingsOverview;
  readonly pricingTemplates: readonly PricingTemplateRow[];
  readonly initialTab?: SettingsTab;
  readonly administration: AdministrationOverview | null;
  readonly readiness: readonly ProductionReadinessItem[];
  readonly onboarding: OwnerOnboardingOverview | null;
  readonly initialStock: readonly InitialStockCandidate[];
  readonly openingBatches: readonly InventoryOpeningBatchView[];
};

function toHubOverview(overview: SettingsOverview): SettingsHubOverview {
  const categoryAllocationRatio =
    overview.budgetAllocationSetting?.categories.reduce(
      (total, category) => total + (category.isEnabled ? category.ratioPercentage : 0),
      0,
    ) ?? 0;

  return {
    roleName: overview.roleName,
    permissions: overview.permissions,
    budgetCapRatio: overview.budgetAllocationSetting?.budgetCapRatio ?? 0,
    categoryAllocationRatio,
    unallocatedBufferRatio: Math.max(0, 1 - categoryAllocationRatio),
    activeCategoryCount: overview.expenseCategories.filter((category) => category.isActive).length,
    activeItemCount: overview.itemLibrary.filter((item) => item.isActive).length,
    activeMaterialCount: overview.materials.filter((material) => material.isActive).length,
  };
}

export function SettingsDashboard({
  initialTab = "overview",
  overview,
  pricingTemplates,
  administration,
  readiness,
  onboarding,
  initialStock,
  openingBatches,
}: SettingsDashboardProps): React.JSX.Element {
  const tabParam = useBrowserUrlSearchParam("tab", initialTab === "overview" ? null : initialTab);
  const activeTab = tabParam ? parseSettingsTab(tabParam) : initialTab;
  const hubOverview = React.useMemo(() => toHubOverview(overview), [overview]);

  function changeTab(tab: SettingsTab): void {
    updateBrowserUrl(settingsTabUrl(tab), "replace");
  }

  let content: React.JSX.Element;

  if (activeTab === "setup") {
    content = onboarding ? (
      <SetupReadinessManager
        overview={onboarding}
        inventory={initialStock}
        batches={openingBatches}
      />
    ) : (
      <p className="rounded-3xl bg-white p-5 text-xs text-on-surface-variant">
        Kesiapan setup hanya tersedia untuk Owner.
      </p>
    );
  } else if (activeTab === "administration") {
    content = administration ? (
      <AdministrationManager initialData={administration} />
    ) : (
      <p className="rounded-2xl bg-white p-5">Akses administrasi dibatasi.</p>
    );
  } else if (activeTab === "budget") {
    content = overview.budgetAllocationSetting ? (
      <BudgetSettingsManager
        hideHeader
        initialSetting={overview.budgetAllocationSetting}
        roleName={overview.roleName}
        canManage={overview.permissions.canManageBudgetSettings}
      />
    ) : (
      <p className="rounded-2xl border p-5">Default budget belum tersedia.</p>
    );
  } else if (activeTab === "categories") {
    content = (
      <CategorySettingsManager
        hideHeader
        initialCategories={overview.expenseCategories}
        roleName={overview.roleName}
        canManage={overview.permissions.canManageExpenseCategories}
      />
    );
  } else if (activeTab === "library") {
    content = (
      <LibrarySettingsManager
        hideHeader
        initialItems={pricingTemplates}
        categories={overview.expenseCategories}
        materials={overview.materials}
        vendors={overview.vendors}
        roleName={overview.roleName}
        canManage={overview.permissions.canManageItemLibrary}
      />
    );
  } else if (activeTab === "materials") {
    content = (
      <MaterialSettingsManager
        hideHeader
        initialMaterials={overview.materials}
        initialCategories={overview.materialCategories}
        vendors={overview.vendors}
        locations={overview.inventoryLocations}
        roleName={overview.roleName}
        canManage={overview.permissions.canManageMaterialSettings}
      />
    );
  } else {
    content = (
      <SettingsHub hideHeader data={hubOverview} readiness={readiness} onSelectTab={changeTab} />
    );
  }

  return (
    <section className="min-w-0 space-y-lg pb-8 max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6">
      <SettingsHeader
        eyebrow="Pusat kontrol"
        title="Pengaturan ERP"
        description="Default finansial dan master data untuk alur proyek berikutnya."
        role={overview.roleName}
      />
      <SettingsNavigation
        value={activeTab}
        onChange={changeTab}
        showAdministration={Boolean(administration)}
        showSetup={Boolean(onboarding)}
      />
      <div className="min-w-0">{content}</div>
    </section>
  );
}
