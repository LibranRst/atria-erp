"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { MaterialSettingRow } from "@/app/actions/settings/system";
import {
  DuotoneIconTile,
  GroupedSurface,
  DesktopTable,
  DesktopTablePagination,
  type DesktopTableColumn,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";

import {
  settingsTablePageRows,
  type SettingsTableState,
} from "../../hooks/use-settings-table-state";

type MaterialSettingsListProps = {
  readonly materials: readonly MaterialSettingRow[];
  readonly onSelect: (material: MaterialSettingRow) => void;
  readonly table?: SettingsTableState<MaterialSettingRow>;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
};

const materialColumns: readonly DesktopTableColumn<MaterialSettingRow>[] = [
  {
    key: "material",
    label: "Material",
    sortable: true,
    sortValue: (material) => material.name,
    render: (material) => (
      <div>
        <p className="font-semibold">{material.name}</p>
        <p className="text-meta text-on-surface-variant">
          {[material.code, material.brand, material.color].filter(Boolean).join(" · ") ||
            "Identitas tambahan belum diisi"}
        </p>
      </div>
    ),
  },
  {
    key: "category",
    label: "Kategori",
    sortable: true,
    sortValue: (material) => material.categoryName,
    render: (material) => material.categoryName,
  },
  {
    key: "unit",
    label: "Satuan",
    sortable: true,
    sortValue: (material) => material.unit,
    render: (material) => material.unit,
  },
  {
    key: "vendor",
    label: "Vendor default",
    sortable: true,
    sortValue: (material) => material.defaultVendorName ?? "",
    render: (material) => material.defaultVendorName ?? "Belum ditentukan",
  },
  {
    key: "locations",
    label: "Lokasi default",
    sortable: true,
    sortValue: (material) => material.inventory.length,
    render: (material) => `${material.inventory.length} lokasi`,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortValue: (material) => Number(material.isActive),
    render: (material) => (
      <WorkspaceStatusLabel
        label={material.isActive ? "Aktif" : "Arsip"}
        tone={material.isActive ? "neutral" : "inactive"}
      />
    ),
  },
];

export function MaterialSettingsList({
  materials,
  onSelect,
  table,
  emptyTitle,
  emptyDescription,
}: MaterialSettingsListProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop)
    return (
      <DesktopTable
        ariaLabel="Material master"
        rows={table ? settingsTablePageRows(materials, materialColumns, table) : materials}
        rowKey={(material) => material.id}
        onRowAction={onSelect}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        columns={
          table
            ? materialColumns
            : materialColumns.map((column) => ({ ...column, sortable: false }))
        }
        sortDescriptor={table?.sortDescriptor}
        onSortChange={table?.onSortChange}
        footer={
          table ? (
            <DesktopTablePagination
              page={table.page}
              pageSize={table.pageSize}
              total={materials.length}
              onPageChange={table.onPageChange}
              onPageSizeChange={table.onPageSizeChange}
              ariaLabel="Halaman material master"
            />
          ) : undefined
        }
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
