"use client";

import {
  useWorkspacePresentation,
  useWorkspaceHref,
} from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { useCan } from "@/components/auth/permissions-provider";
import { ApprovalControlManager } from "../budget/approval-control-manager";
import type { ApprovalThresholdSettings } from "@/server/usecases/settings/approval-thresholds";
import React from "react";

import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { SettingsOverview } from "@/app/actions/settings/system";
import type { AdministrationOverview } from "@/app/actions/administration";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { GroupedSurface, InlineStateRow } from "@/components/ui";
import { AdministrationManager } from "@/features/administration/components/workspaces/administration-manager";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { BudgetSettingsManager } from "../budget/budget-settings-manager";
import { CatalogSettingsManager } from "../catalog/catalog-settings-manager";
import { SettingsNavigation } from "./settings-navigation";
import { SettingsHeader } from "../shared/settings-ui";
import { SetupReadinessManager } from "../shared/setup-readiness-manager";
import { OrganizationSetupCard } from "@/features/onboarding/components/quick-start/organization-setup-card";
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
  readonly setup: OrganizationSetupOverview | null;
  readonly initialStock: readonly InitialStockCandidate[];
  readonly openingBatches: readonly InventoryOpeningBatchView[];
  readonly approvalThresholds: ApprovalThresholdSettings | null;
};

export function SettingsDashboard({
  initialTab = "financial",
  overview,
  pricingTemplates,
  administration,
  setup,
  initialStock,
  openingBatches,
  approvalThresholds,
}: SettingsDashboardProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const can = useCan();
  const tabParam = useBrowserUrlSearchParam("tab", initialTab === "financial" ? null : initialTab);
  const sectionParam = useBrowserUrlSearchParam("section");
  const activeTab = parseSettingsTab(tabParam);

  function changeTab(nextTab: SettingsTab): void {
    updateBrowserUrl(workspaceHref(settingsTabUrl(nextTab)), "replace");
  }

  let content: React.JSX.Element;

  if (activeTab === "readiness") {
    content = setup ? (
      <SetupReadinessManager overview={setup} inventory={initialStock} batches={openingBatches} />
    ) : (
      <ModuleUnavailableState
        title="Kesiapan belum dapat dimuat"
        description="Muat ulang halaman untuk membaca status fondasi operasional."
      />
    );
  } else if (activeTab === "organization") {
    content = administration ? (
      <AdministrationManager
        initialData={administration}
        presentation="settings"
        onMutationComplete={() => router.refresh()}
      />
    ) : (
      <ModuleUnavailableState
        title="Akses administrasi dibatasi"
        description="Tim dan vendor hanya dapat dikelola oleh role dengan izin administrasi."
      />
    );
  } else if (activeTab === "catalog") {
    content = (
      <CatalogSettingsManager
        initialSubTab={sectionParam === "library" ? "library" : "materials"}
        initialMaterials={overview.materials}
        initialCategories={overview.materialCategories}
        pricingTemplates={pricingTemplates}
        expenseCategories={overview.expenseCategories}
        vendors={overview.vendors}
        locations={overview.inventoryLocations}
        canManageMaterials={overview.permissions.canManageMaterialSettings}
        canManageLibrary={overview.permissions.canManageItemLibrary}
        onMutationComplete={() => router.refresh()}
      />
    );
  } else {
    content = (
      <div
        className={
          desktop
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]"
            : "space-y-sm"
        }
      >
        {overview.budgetAllocationSetting ? (
          <BudgetSettingsManager
            initialSetting={overview.budgetAllocationSetting}
            initialCategories={overview.expenseCategories}
            canManage={overview.permissions.canManageBudgetSettings}
            canManageCategories={overview.permissions.canManageExpenseCategories}
            onMutationComplete={() => router.refresh()}
          />
        ) : (
          <ModuleUnavailableState
            title="Default budget belum tersedia"
            description="Buat default alokasi budget terlebih dahulu sebelum mengatur formula dan kategori."
          />
        )}
        {approvalThresholds ? (
          <ApprovalControlManager
            fieldCostCents={approvalThresholds.fieldCostCents}
            vendorPaymentCents={approvalThresholds.vendorPaymentCents}
            canManage={can("manage:approval_settings")}
            onMutationComplete={() => router.refresh()}
          />
        ) : null}
      </div>
    );
  }

  const flowParam = useBrowserUrlSearchParam("flow");
  const isSubflow = activeTab === "readiness" && Boolean(flowParam);

  if (isSubflow) {
    return (
      <section className="min-w-0 space-y-sm pb-32 max-[430px]:-mx-1 max-[430px]:pb-28 md:pb-12">
        {content}
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-sm pb-32 max-[430px]:-mx-1 max-[430px]:pb-28 md:pb-12">
      <SettingsHeader
        title="Pengaturan"
        description="Konfigurasi default finansial, master data katalog, dan akses organisasi."
        role={overview.roleName}
      />

      {setup && activeTab !== "readiness" ? (
        <OrganizationSetupCard overview={setup} density="settings" />
      ) : null}

      <SettingsNavigation
        value={activeTab}
        onChange={changeTab}
        showAdministration={
          overview.permissions.canManageUsers || overview.permissions.canManageVendors
        }
      />

      <div className="min-w-0">{content}</div>
    </section>
  );
}
