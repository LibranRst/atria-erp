import React from "react";
import type { MaterialSettingRow } from "@/app/actions/settings/system";
import {
  AppIcon,
  GroupedSurface,
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
  return (
    <GroupedSurface>
      <div className="divide-y divide-black/5.5">
        {materials.map((material) => (
          <button
            type="button"
            key={material.id}
            onClick={() => onSelect(material)}
            className="flex min-h-22 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface">
              <AppIcon name="warehouse" className="icon-sm" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] leading-5 font-bold text-on-surface">
                  {material.name}
                </span>
              </span>
              <span className="mt-1 block truncate text-meta text-on-surface-variant">
                {[material.brand, material.code, material.color, material.unit]
                  .filter(Boolean)
                  .join(" · ") || "Detail material belum dilengkapi"}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-[9px] leading-4 text-on-surface-variant">
                <span className="truncate">{material.inventory.length} lokasi default</span>
                {material.defaultVendorName ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{material.defaultVendorName}</span>
                  </>
                ) : null}
              </span>
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <WorkspaceStatusLabel
                label={material.isActive ? material.categoryName : "Diarsipkan"}
                tone={material.isActive ? "neutral" : "inactive"}
              />
              <WorkspaceRowChevron />
            </div>
          </button>
        ))}
      </div>
    </GroupedSurface>
  );
}
