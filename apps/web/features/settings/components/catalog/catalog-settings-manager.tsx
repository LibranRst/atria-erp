"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { ExpenseCategorySettingRow, MaterialSettingRow } from "@/app/actions/settings/system";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import { AppIcon, SegmentedTabs } from "@/components/ui";
import { MaterialSettingsManager } from "../materials/material-settings-manager";
import { LibrarySettingsManager } from "../library/library-settings-manager";
import { LocationSettingsManager } from "../locations/location-settings-manager";
import type { VendorOption } from "../../types/library-types";
import type { SettingsOption } from "../../types/material-types";

export type CatalogSubTab = "materials" | "library" | "locations";

type CatalogSettingsManagerProps = {
  readonly initialMaterials: readonly MaterialSettingRow[];
  readonly initialCategories: readonly SettingsOption[];
  readonly pricingTemplates: readonly PricingTemplateRow[];
  readonly expenseCategories: readonly ExpenseCategorySettingRow[];
  readonly vendors: readonly (VendorOption & SettingsOption)[];
  readonly locations: readonly SettingsOption[];
  readonly canManageMaterials: boolean;
  readonly canManageLibrary: boolean;
  readonly initialSubTab?: CatalogSubTab;
  readonly subTab?: CatalogSubTab;
  readonly onSubTabChange?: (subTab: CatalogSubTab) => void;
  readonly onMutationComplete?: () => void;
};

export function CatalogSettingsManager({
  initialMaterials,
  initialCategories,
  pricingTemplates,
  expenseCategories,
  vendors,
  locations,
  canManageMaterials,
  canManageLibrary,
  initialSubTab = "materials",
  subTab: controlledSubTab,
  onSubTabChange,
  onMutationComplete,
}: CatalogSettingsManagerProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const [localSubTab, setLocalSubTab] = React.useState<CatalogSubTab>(initialSubTab);
  const subTab = controlledSubTab ?? localSubTab;
  function changeSubTab(next: CatalogSubTab): void {
    if (onSubTabChange) onSubTabChange(next);
    else setLocalSubTab(next);
  }

  const materialsCount = initialMaterials.filter((m) => m.isActive).length;
  const libraryCount = pricingTemplates.filter((p) => p.isActive).length;
  const locationsCount = locations.length;

  return (
    <div className="space-y-sm">
      <SegmentedTabs
        value={subTab}
        onChange={changeSubTab}
        ariaLabel="Submodul Katalog"
        layoutId="settings-catalog-subtabs"
        density="compact"
        fillAvailableSpace={!desktop}
        options={[
          {
            value: "materials",
            label: "Material",
            count: materialsCount > 0 ? materialsCount : undefined,
            countLabel: `${materialsCount} material aktif`,
            icon: <AppIcon name="warehouse" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
          {
            value: "library",
            label: "Library",
            count: libraryCount > 0 ? libraryCount : undefined,
            countLabel: `${libraryCount} template aktif`,
            icon: <AppIcon name="inventory" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
          {
            value: "locations",
            label: "Lokasi",
            count: locationsCount > 0 ? locationsCount : undefined,
            countLabel: `${locationsCount} lokasi penyimpanan aktif`,
            icon: <AppIcon name="location_on" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
        ]}
      />

      <div className="min-w-0">
        {subTab === "materials" ? (
          <MaterialSettingsManager
            initialMaterials={initialMaterials}
            initialCategories={initialCategories}
            vendors={vendors}
            locations={locations}
            canManage={canManageMaterials}
            onMutationComplete={onMutationComplete}
          />
        ) : subTab === "library" ? (
          <LibrarySettingsManager
            initialItems={pricingTemplates}
            categories={expenseCategories}
            materials={initialMaterials}
            vendors={vendors}
            canManage={canManageLibrary}
            onMutationComplete={onMutationComplete}
          />
        ) : (
          <LocationSettingsManager
            locations={locations}
            activeMaterialCount={materialsCount}
            canManage={canManageMaterials}
            onMutationComplete={onMutationComplete}
          />
        )}
      </div>
    </div>
  );
}
