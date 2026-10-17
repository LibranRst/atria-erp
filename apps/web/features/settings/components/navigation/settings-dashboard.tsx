"use client";

import {
  useWorkspacePresentation,
  useWorkspaceHref,
} from "@/lib/navigation/workspace-presentation";
import { useRouter, usePathname } from "@/lib/navigation/workspace-navigation";

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
import { ConfirmationDialog, GroupedSurface, InlineStateRow, PageState } from "@/components/ui";
import type { SettingsReadSource, SettingsReadSources } from "@atria/core/settings/read-sources";
import { AdministrationManager } from "@/features/administration/components/workspaces/administration-manager";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { BudgetSettingsManager } from "../budget/budget-settings-manager";
import { CatalogSettingsManager, type CatalogSubTab } from "../catalog/catalog-settings-manager";
import { SettingsNavigation } from "./settings-navigation";
import { SettingsHeader } from "../shared/settings-ui";
import { ManagedRolesReadProvider } from "@/features/administration/components/roles/managed-roles-read-provider";
import { SetupReadinessManager } from "../shared/setup-readiness-manager";
import { OrganizationSetupCard } from "@/features/onboarding/components/quick-start/organization-setup-card";
import { resolveSettingsTab, type SettingsTab } from "../../utils/settings-tabs-config";
import { hasSettingsAdministrationAccess } from "../../utils/settings-administration-access";

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

function ReadSourceState({
  source,
  title,
}: {
  readonly source: SettingsReadSource | undefined;
  readonly title: string;
}): React.JSX.Element {
  const router = useRouter();
  const restricted = source?.status === "restricted" || source?.status === "unauthorized";
  return (
    <PageState
      kind={restricted ? "restricted" : "error"}
      title={restricted ? "Akses bagian ini dibatasi" : title}
      description={
        source && "message" in source
          ? source.message
          : "Data belum dapat dimuat. Coba muat ulang bagian ini."
      }
      actionLabel={restricted ? undefined : "Coba lagi"}
      onAction={restricted ? undefined : (): void => router.refresh()}
      compact
    />
  );
}

type SettingsDashboardProps = {
  readonly overview: SettingsOverview;
  readonly pricingTemplates: readonly PricingTemplateRow[];
  readonly initialTab?: SettingsTab;
  readonly initialCatalogSubTab?: CatalogSubTab;
  readonly administration: AdministrationOverview | null;
  readonly setup: OrganizationSetupOverview | null;
  readonly initialStock: readonly InitialStockCandidate[];
  readonly openingBatches: readonly InventoryOpeningBatchView[];
  readonly approvalThresholds: ApprovalThresholdSettings | null;
  readonly sources?: SettingsReadSources;
};

export function SettingsDashboard(props: SettingsDashboardProps): React.JSX.Element {
  return (
    <ManagedRolesReadProvider generation={props.administration}>
      <SettingsDashboardContent {...props} />
    </ManagedRolesReadProvider>
  );
}

function SettingsDashboardContent({
  initialTab = "financial",
  initialCatalogSubTab = "materials",
  overview,
  pricingTemplates,
  administration,
  setup,
  initialStock,
  openingBatches,
  approvalThresholds,
  sources,
}: SettingsDashboardProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const pathname = usePathname();
  const can = useCan();
  const [budgetDirty, setBudgetDirty] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<SettingsTab | null>(null);
  const tabParam = useBrowserUrlSearchParam("tab", initialTab === "financial" ? null : initialTab);
  const sectionParam = useBrowserUrlSearchParam("section");
  const activeTab = resolveSettingsTab(pathname, tabParam, initialTab);
  const catalogSubTab: CatalogSubTab =
    sectionParam === "library" || sectionParam === "locations" || sectionParam === "materials"
      ? sectionParam
      : tabParam === "library" || pathname === "/settings/library"
        ? "library"
        : initialCatalogSubTab;

  function navigateTab(nextTab: SettingsTab): void {
    const url = new URL(window.location.href);
    if (nextTab === "financial") url.searchParams.delete("tab");
    else url.searchParams.set("tab", nextTab);
    url.searchParams.delete("section");
    url.searchParams.delete("flow");
    updateBrowserUrl(workspaceHref(`/settings${url.search}${url.hash}`), "replace");
  }
  function changeTab(nextTab: SettingsTab): void {
    if (nextTab === activeTab) return;
    if (budgetDirty) setPendingTab(nextTab);
    else navigateTab(nextTab);
  }
  function changeCatalogSubTab(next: CatalogSubTab): void {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "catalog");
    url.searchParams.set("section", next);
    updateBrowserUrl(workspaceHref(`/settings${url.search}${url.hash}`), "replace");
  }

  let content: React.JSX.Element;

  if (activeTab === "readiness") {
    content = setup ? (
      <SetupReadinessManager
        overview={setup}
        inventory={initialStock}
        batches={openingBatches}
        sources={sources}
      />
    ) : (
      <ReadSourceState source={sources?.setup} title="Kesiapan belum dapat dimuat" />
    );
  } else if (activeTab === "organization") {
    content = administration ? (
      <AdministrationManager
        initialData={administration}
        presentation="settings"
        onMutationComplete={() => router.refresh()}
      />
    ) : (
      <ReadSourceState
        source={sources?.administration}
        title="Data administrasi belum dapat dimuat"
      />
    );
  } else if (activeTab === "catalog") {
    content = (
      <CatalogSettingsManager
        subTab={catalogSubTab}
        onSubTabChange={changeCatalogSubTab}
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
      <div className={desktop ? "min-w-0 space-y-4" : "space-y-sm"}>
        {overview.budgetAllocationSetting ? (
          <BudgetSettingsManager
            initialSetting={overview.budgetAllocationSetting}
            initialCategories={overview.expenseCategories}
            canManage={overview.permissions.canManageBudgetSettings}
            canManageCategories={overview.permissions.canManageExpenseCategories}
            onDirtyChange={setBudgetDirty}
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
        ) : sources?.approvalThresholds && sources.approvalThresholds.status !== "ready" ? (
          <ReadSourceState
            source={sources.approvalThresholds}
            title="Ambang persetujuan belum dapat dimuat"
          />
        ) : null}
      </div>
    );
  }

  const flowParam = useBrowserUrlSearchParam("flow");
  const isSubflow = activeTab === "readiness" && Boolean(flowParam);

  if (isSubflow) {
    return (
      <section
        className={
          desktop
            ? "min-w-0 space-y-4 pb-6"
            : "min-w-0 space-y-sm pb-32 max-[430px]:-mx-1 max-[430px]:pb-28 md:pb-12"
        }
      >
        {content}
      </section>
    );
  }

  return (
    <section
      className={
        desktop
          ? "min-w-0 space-y-4 pb-6"
          : "min-w-0 space-y-sm pb-32 max-[430px]:-mx-1 max-[430px]:pb-28 md:pb-12"
      }
    >
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
          can("manage:roles") ||
          hasSettingsAdministrationAccess(
            administration?.capabilities ?? null,
            overview.permissions,
          )
        }
      />

      <div className="min-w-0">{content}</div>
      <ConfirmationDialog
        open={pendingTab !== null}
        title="Tinggalkan perubahan finansial?"
        description="Perubahan default belum disimpan. Pindah bagian akan membuang isian yang belum disimpan."
        confirmLabel="Buang dan pindah"
        onClose={(): void => setPendingTab(null)}
        onConfirm={(): void => {
          if (pendingTab) navigateTab(pendingTab);
          setBudgetDirty(false);
          setPendingTab(null);
        }}
      />
    </section>
  );
}
