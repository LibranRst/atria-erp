"use client";

import React from "react";
import { toast } from "sonner";

import { createInventoryLocation } from "@/app/actions/material/warehouse";
import type { SettingsOverview } from "@/app/actions/settings/system";
import { AppIcon, SegmentedTabs } from "@/components/ui";
import { InventoryLocationSheet } from "@/features/materials/components/sheets/inventory-location-sheet";
import { MaterialSettingsManager } from "@/features/settings/components/materials/material-settings-manager";
import {
  OnboardingEmpty,
  OnboardingNotice,
  OnboardingStage,
  OnboardingSurface,
  OnboardingToolbar,
} from "../shared/onboarding-primitives";

export function MaterialFoundationPanel({
  settings,
  onMutationComplete,
}: {
  readonly settings: SettingsOverview;
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<"LOCATIONS" | "MATERIALS">("LOCATIONS");
  const [locations, setLocations] = React.useState(settings.inventoryLocations);
  const [locationOpen, setLocationOpen] = React.useState(false);
  const [locationName, setLocationName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function saveLocation(): Promise<void> {
    setPending(true);
    const result = await createInventoryLocation({
      name: locationName,
      description: null,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setLocations((current) => [...current, { id: result.data.id, name: result.data.name }]);
    setLocationOpen(false);
    setLocationName("");
    toast.success("Lokasi inventory ditambahkan.");
    onMutationComplete();
  }

  return (
    <OnboardingStage>
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        ariaLabel="Fondasi material onboarding"
        density="compact"
        options={[
          { value: "LOCATIONS", label: "Lokasi" },
          { value: "MATERIALS", label: "Material" },
        ]}
      />
      {tab === "LOCATIONS" ? (
        <div className="space-y-3">
          <OnboardingToolbar
            title="Tempat penyimpanan"
            detail="Contoh: Gudang Utama atau Workshop."
            actionLabel="Buat lokasi"
            onAction={() => setLocationOpen(true)}
          />
          <OnboardingSurface>
            {locations.length === 0 ? (
              <OnboardingEmpty
                icon="warehouse"
                title="Belum ada lokasi"
                detail="Lokasi pertama membuka langkah pembuatan Material Master."
              />
            ) : (
              <div className="divide-y divide-black/5.5">
                {locations.map((location) => (
                  <div key={location.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <AppIcon
                      name="warehouse"
                      className="flex! icon-md h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant"
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-on-surface">
                      {location.name}
                    </span>
                    <AppIcon name="check" className="text-[17px] text-success" />
                  </div>
                ))}
              </div>
            )}
          </OnboardingSurface>
          <OnboardingNotice>
            Lokasi baru hanya menyiapkan row inventory bersaldo nol. Belum ada stok fisik yang
            tercatat.
          </OnboardingNotice>
        </div>
      ) : locations.length === 0 ? (
        <div className="space-y-3">
          <OnboardingSurface>
            <OnboardingEmpty
              icon="lock"
              title="Material menunggu lokasi"
              detail="Buat minimal satu lokasi agar inventory awal material dapat ditempatkan dengan benar."
            />
          </OnboardingSurface>
          <button
            type="button"
            onClick={() => {
              setTab("LOCATIONS");
              setLocationOpen(true);
            }}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary"
          >
            Buat lokasi pertama
          </button>
        </div>
      ) : (
        <MaterialSettingsManager
          key={settings.materials.map((row) => row.id).join(":")}
          initialMaterials={settings.materials}
          initialCategories={settings.materialCategories}
          vendors={settings.vendors}
          locations={locations}
          roleName={settings.roleName}
          canManage={settings.permissions.canManageMaterialSettings}
          presentation="onboarding"
          hideHeader
          onMutationComplete={onMutationComplete}
        />
      )}
      <InventoryLocationSheet
        open={locationOpen}
        pending={pending}
        name={locationName}
        activeMaterialCount={settings.materials.filter((row) => row.isActive).length}
        onNameChange={setLocationName}
        onClose={() => setLocationOpen(false)}
        onSubmit={() => void saveLocation()}
      />
    </OnboardingStage>
  );
}
