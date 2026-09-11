"use client";

import React from "react";
import type { ExpenseCategorySettingRow, MaterialSettingRow } from "@/app/actions/settings/system";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import { AppIcon, SegmentedTabs } from "@/components/ui";
import { MaterialSettingsManager } from "../materials/material-settings-manager";
import { LibrarySettingsManager } from "../library/library-settings-manager";
import { LocationSettingsManager } from "../locations/location-settings-manager";
import type { MaterialOption, VendorOption } from "../../types/library-types";
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
  onMutationComplete,
}: CatalogSettingsManagerProps): React.JSX.Element {
  const [subTab, setSubTab] = React.useState<CatalogSubTab>(initialSubTab);

  const materialsCount = initialMaterials.filter((m) => m.isActive).length;
  const libraryCount = pricingTemplates.filter((p) => p.isActive).length;
  const locationsCount = locations.length;

  return (
    <div className="space-y-sm">
      <SegmentedTabs
        value={subTab}
        onChange={setSubTab}
        ariaLabel="Submodul Katalog"
        layoutId="settings-catalog-subtabs"
        density="compact"
        fillAvailableSpace
        options={[
          {
            value: "materials",
            label: "Material",
            count: materialsCount > 0 ? materialsCount : undefined,
            icon: <AppIcon name="warehouse" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
          {
            value: "library",
            label: "Library",
            count: libraryCount > 0 ? libraryCount : undefined,
            icon: <AppIcon name="inventory" className="h-3.75 w-3.75" aria-hidden="true" />,
          },
          {
            value: "locations",
            label: "Lokasi",
            count: locationsCount > 0 ? locationsCount : undefined,
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
            materials={initialMaterials as unknown as readonly MaterialOption[]}
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
