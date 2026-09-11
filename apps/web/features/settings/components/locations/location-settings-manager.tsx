"use client";

import React from "react";
import { toast } from "sonner";

import { createInventoryLocation } from "@/app/actions/material/warehouse";
import { AppIcon, EmptyState, GroupedSurface } from "@/components/ui";
import { InventoryLocationSheet } from "@/features/materials/components/sheets/inventory-location-sheet";
import type { SettingsOption } from "../../types/material-types";

type LocationSettingsManagerProps = {
  readonly locations: readonly SettingsOption[];
  readonly activeMaterialCount: number;
  readonly canManage: boolean;
  readonly onMutationComplete?: () => void;
};

export function LocationSettingsManager({
  locations: initialLocations,
  activeMaterialCount,
  canManage,
  onMutationComplete,
}: LocationSettingsManagerProps): React.JSX.Element {
  const [addedLocations, setAddedLocations] = React.useState<readonly SettingsOption[]>([]);
  const [showLocationSheet, setShowLocationSheet] = React.useState(false);
  const [locationName, setLocationName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const locations = React.useMemo(() => {
    const existingIds = new Set(initialLocations.map((loc) => loc.id));
    return [...initialLocations, ...addedLocations.filter((loc) => !existingIds.has(loc.id))];
  }, [initialLocations, addedLocations]);

  function handleCreateLocation(): void {
    const trimmed = locationName.trim();
    if (trimmed.length < 3) return;

    startTransition(async () => {
      const result = await createInventoryLocation({
        name: trimmed,
        description: null,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      setAddedLocations((current) => [...current, { id: result.data.id, name: result.data.name }]);
      setShowLocationSheet(false);
      setLocationName("");
      toast.success("Lokasi gudang baru berhasil ditambahkan.");
      onMutationComplete?.();
    });
  }

  return (
    <section className="space-y-sm min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 px-1">
          <span className="block text-[13px] leading-5 font-bold text-on-surface">
            Lokasi Gudang & Workshop
          </span>
          <span className="block text-meta text-on-surface-variant">
            {locations.length} lokasi penyimpanan aktif
          </span>
        </span>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowLocationSheet(true)}
            className="hover:bg-primary-hover flex h-12 shrink-0 items-center justify-center rounded-full bg-primary px-3.5 text-xs font-bold text-white shadow-control max-[420px]:w-12 max-[420px]:px-0"
            title="Tambah Lokasi Gudang Baru"
          >
            <AppIcon name="add" className="icon-sm" />
            <span className="ml-1 max-[420px]:hidden">Tambah</span>
          </button>
        ) : null}
      </div>

      {locations.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            title="Belum ada lokasi gudang"
            description="Tambahkan lokasi gudang atau workshop pertama untuk menempatkan stok material dan pencatatan inventori."
          />
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowLocationSheet(true)}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary shadow-control"
            >
              Buat lokasi gudang pertama
            </button>
          ) : null}
        </div>
      ) : (
        <GroupedSurface>
          <div className="divide-y divide-black/5.5">
            {locations.map((loc) => (
              <div key={loc.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant">
                  <AppIcon name="warehouse" className="icon-sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-row font-bold text-on-surface">
                    {loc.name}
                  </span>
                  <span className="block text-meta text-on-surface-variant">
                    Tempat penyimpanan inventori
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/8 px-2.5 py-1 text-[11px] font-semibold text-success">
                  <AppIcon name="check_circle" className="icon-xs" />
                  Aktif
                </span>
              </div>
            ))}
          </div>
        </GroupedSurface>
      )}

      <InventoryLocationSheet
        open={showLocationSheet}
        pending={pending}
        name={locationName}
        activeMaterialCount={activeMaterialCount}
        onNameChange={setLocationName}
        onClose={() => {
          setShowLocationSheet(false);
          setLocationName("");
        }}
        onSubmit={handleCreateLocation}
      />
    </section>
  );
}
