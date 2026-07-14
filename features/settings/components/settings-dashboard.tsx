"use client";

import React from "react";

import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type {
  SettingsHubOverview,
  SettingsOverview,
} from "@/app/actions/settings/system";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  updateBrowserUrl,
  useBrowserUrlSearchParam,
} from "@/lib/utils/use-url-search-param";
import { BudgetSettingsManager } from "./budget-settings-manager";
import { CategorySettingsManager } from "./category-settings-manager";
import { LibrarySettingsManager } from "./library-settings-manager";
import { MaterialSettingsManager } from "./material-settings-manager";
import { SettingsHub } from "./settings-hub";
import { SettingsHeader, SettingsNotice } from "./settings-ui";
import {
  parseSettingsTab,
  SETTINGS_TABS,
  settingsTabUrl,
  type SettingsTab,
} from "./settings-tabs-config";

type SettingsDashboardProps = {
  readonly overview: SettingsOverview;
  readonly pricingTemplates: readonly PricingTemplateRow[];
  readonly initialTab?: SettingsTab;
};

type SettingsHeaderCopy = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly canManageKey?: keyof SettingsOverview["permissions"];
};

function toHubOverview(overview: SettingsOverview): SettingsHubOverview {
  const categoryAllocationRatio =
    overview.budgetAllocationSetting?.categories.reduce(
      (total, category) =>
        total + (category.isEnabled ? category.ratioPercentage : 0),
      0,
    ) ?? 0;

  return {
    roleName: overview.roleName,
    permissions: overview.permissions,
    budgetCapRatio: overview.budgetAllocationSetting?.budgetCapRatio ?? 0,
    categoryAllocationRatio,
    unallocatedBufferRatio: Math.max(0, 1 - categoryAllocationRatio),
    activeCategoryCount: overview.expenseCategories.filter(
      (category) => category.isActive,
    ).length,
    activeItemCount: overview.itemLibrary.filter((item) => item.isActive).length,
    activeMaterialCount: overview.materials.filter((material) => material.isActive)
      .length,
  };
}

function getHeaderCopy(tab: SettingsTab): SettingsHeaderCopy {
  if (tab === "budget") {
    return {
      eyebrow: "Default finansial",
      title: "Alokasi Budget",
      description:
        "Rasio kategori memakai Budget Internal. Buffer dan margin kotor dihitung terpisah.",
      canManageKey: "canManageBudgetSettings",
    };
  }

  if (tab === "categories") {
    return {
      eyebrow: "Kategori baku",
      title: "Kategori Pengeluaran",
      description:
        "Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten.",
      canManageKey: "canManageExpenseCategories",
    };
  }

  if (tab === "library") {
    return {
      eyebrow: "Template proyek berulang",
      title: "Library Item & Harga",
      description:
        "Template untuk RAP, paket kerja, Subcon, dan baris RAB. Harga berasal dari rincian biaya serta target margin kotor yang terlihat.",
      canManageKey: "canManageItemLibrary",
    };
  }

  if (tab === "materials") {
    return {
      eyebrow: "Identitas & default material",
      title: "Material Master",
      description:
        "Identitas material dan default inventori. Pergerakan stok tetap dilakukan di Material & Stok.",
      canManageKey: "canManageMaterialSettings",
    };
  }

  return {
    eyebrow: "Pusat kontrol",
    title: "Pengaturan ERP",
    description: "Default budget dan master data untuk alur proyek baru.",
  };
}

export function SettingsDashboard({
  initialTab = "overview",
  overview,
  pricingTemplates,
}: SettingsDashboardProps): React.JSX.Element {
  const tabParam = useBrowserUrlSearchParam(
    "tab",
    initialTab === "overview" ? null : initialTab,
  );
  const activeTab = tabParam ? parseSettingsTab(tabParam) : initialTab;
  const hubOverview = React.useMemo(() => toHubOverview(overview), [overview]);

  function changeTab(tab: SettingsTab): void {
    updateBrowserUrl(settingsTabUrl(tab), "replace");
  }

  const headerCopy = getHeaderCopy(activeTab);
  const canManage =
    headerCopy.canManageKey === undefined
      ? undefined
      : overview.permissions[headerCopy.canManageKey];

  let content: React.JSX.Element;

  if (activeTab === "budget") {
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
      <SettingsHub hideHeader data={hubOverview} onSelectTab={changeTab} />
    );
  }

  return (
    <section className="min-w-0 space-y-md">
      <SettingsHeader
        eyebrow={headerCopy.eyebrow}
        title={headerCopy.title}
        description={headerCopy.description}
        role={overview.roleName}
        canManage={canManage}
      />
      <SegmentedTabs
        value={activeTab}
        onChange={changeTab}
        ariaLabel="Settings modules"
        scrollable
        options={SETTINGS_TABS.map((module) => {
          const Icon = module.icon;
          return {
            value: module.value,
            label: module.label,
            icon: <Icon className="h-4 w-4" aria-hidden="true" />,
          };
        })}
      />
      <div className="min-w-0 space-y-md">
        <SettingsNotice />
        {content}
      </div>
    </section>
  );
}
