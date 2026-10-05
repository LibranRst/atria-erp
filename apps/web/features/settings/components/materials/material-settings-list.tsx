"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { MaterialSettingRow } from "@/app/actions/settings/system";
import {
  DuotoneIconTile,
  GroupedSurface,
  DesktopTable,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";

type MaterialSettingsListProps = {
  readonly materials: readonly MaterialSettingRow[];
  readonly onSelect: (material: MaterialSettingRow) => void;
};

export function MaterialSettingsList({
  materials,
  onSelect,
}: MaterialSettingsListProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop)
    return (
      <DesktopTable
        ariaLabel="Material master"
        rows={materials}
        rowKey={(material) => material.id}
        onRowAction={onSelect}
        columns={[
          {
            key: "material",
            label: "Material",
            render: (material) => (
              <div>
                <p className="font-semibold">{material.name}</p>
                <p className="text-meta text-on-surface-variant">
                  {material.brand} · {material.color}
                </p>
              </div>
            ),
          },
          { key: "category", label: "Kategori", render: (material) => material.categoryName },
          { key: "unit", label: "Satuan", render: (material) => material.unit },
          {
            key: "vendor",
            label: "Vendor default",
            render: (material) => material.defaultVendorName ?? "Belum ditentukan",
          },
          {
            key: "locations",
            label: "Lokasi default",
            render: (material) => `${material.inventory.length} lokasi`,
          },
          {
            key: "status",
            label: "Status",
            render: (material) => (
              <WorkspaceStatusLabel
                label={material.isActive ? "Aktif" : "Arsip"}
                tone={material.isActive ? "neutral" : "inactive"}
              />
            ),
          },
        ]}
      />
    );
  return (
    <GroupedSurface>
      <div className="divide-y divide-black/5.5">
        {materials.map((material) => (
          <button
            type="button"
            key={material.id}
            onClick={() => onSelect(material)}
            className="flex min-h-20 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75"
          >
            <DuotoneIconTile name="warehouse" className="h-9 w-9" iconClassName="icon-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-row font-bold text-on-surface">{material.name}</span>
                <WorkspaceStatusLabel
                  label={material.isActive ? material.categoryName : "Arsip"}
                  tone={material.isActive ? "neutral" : "inactive"}
                />
              </div>
              <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                {[
                  material.brand,
                  material.code,
                  material.color,
                  material.unit ? `Satuan ${material.unit}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Detail material"}
              </p>
              {material.inventory.length > 0 || material.defaultVendorName ? (
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-meta text-on-surface-variant/80">
                  <span>{material.inventory.length} lokasi default</span>
                  {material.defaultVendorName ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">Vendor: {material.defaultVendorName}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <WorkspaceRowChevron />
          </button>
        ))}
      </div>
    </GroupedSurface>
  );
}
