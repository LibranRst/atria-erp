import React from "react";
import { motion } from "framer-motion";
import type { MaterialSettingRow } from "@/app/actions/settings/system";
import {
  AppIcon,
  GroupedSurface,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { DetailSheet } from "@/components/ui";
import type { DetailNextAction } from "../../types/material-types";

type Props = {
  readonly material: MaterialSettingRow | null;
  readonly canManage: boolean;
  readonly onClose: () => void;
  readonly onExitComplete: () => void;
  readonly onNextAction: (action: DetailNextAction) => void;
  readonly onToggle: (material: MaterialSettingRow) => void;
};

export function MaterialDetailSheet({
  material,
  canManage,
  onClose,
  onExitComplete,
  onNextAction,
  onToggle,
}: Props): React.JSX.Element {
  const editMaterial = (): void => {
    if (!material) return;
    onNextAction({
      kind: "EDIT_MATERIAL",
      draft: {
        id: material.id,
        categoryId: material.categoryId,
        defaultVendorId: material.defaultVendorId,
        name: material.name,
        specification: material.specification ?? "",
        brand: material.brand ?? "",
        code: material.code ?? "",
        color: material.color ?? "",
        unit: material.unit,
        isActive: material.isActive,
        locationId: "",
        minimumStock: 0,
        lastPurchasePrice: 0,
      },
    });
    onClose();
  };
  return (
    <DetailSheet
      open={Boolean(material)}
      title="Detail Material"
      onClose={onClose}
      onExitComplete={onExitComplete}
      footer={
        material && canManage ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={editMaterial}
              className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <AppIcon name="edit" className="icon-sm shrink-0" aria-hidden="true" />
              <span className="truncate">Edit identitas</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => onToggle(material)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {material.isActive ? (
                <AppIcon name="archive" className="icon-sm" aria-hidden="true" />
              ) : (
                <AppIcon name="restore" className="icon-sm" aria-hidden="true" />
              )}
              <span>{material.isActive ? "Arsipkan" : "Aktifkan"}</span>
            </motion.button>
          </div>
        ) : undefined
      }
    >
      {material ? (
        <div className="space-y-lg">
          <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
            <div className="p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
                  {material.categoryName}
                </p>
                <WorkspaceStatusLabel
                  label={material.isActive ? "Aktif" : "Diarsipkan"}
                  tone={material.isActive ? "positive" : "inactive"}
                />
              </div>
              <h3 className="mt-1.5 text-[17px] leading-[1.12] font-bold tracking-[-0.015em] text-on-surface">
                {material.name}
              </h3>
              <p className="mt-1 text-[10px] leading-[1.3] text-on-surface-variant">
                {[material.brand, material.code, material.color, material.unit]
                  .filter(Boolean)
                  .join(" · ") || "Identitas tambahan belum diisi"}
              </p>
            </div>
            {material.specification || material.defaultVendorName ? (
              <div className="divide-y divide-outline-variant/15 border-t border-outline-variant/15">
                {material.specification ? (
                  <div className="grid min-h-12 grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-3 px-4 py-3">
                    <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                      Spesifikasi
                    </p>
                    <p className="line-clamp-2 text-right text-[10px] leading-[1.35] text-on-surface">
                      {material.specification}
                    </p>
                  </div>
                ) : null}
                {material.defaultVendorName ? (
                  <div className="grid min-h-12 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                    <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                      Vendor
                    </p>
                    <p className="truncate text-right text-meta font-semibold text-on-surface">
                      {material.defaultVendorName}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
          <section className="space-y-2.5">
            <div>
              <h3 className="text-meta font-bold tracking-[0.11em] text-on-surface uppercase">
                Default inventori
              </h3>
              <p className="mt-0.5 text-meta text-on-surface-variant">
                Batas stok dan harga referensi per lokasi.
              </p>
            </div>
            <GroupedSurface>
              <div className="divide-y divide-black/5.5">
                {material.inventory.map((inventory) => (
                  <button
                    type="button"
                    key={inventory.id}
                    disabled={!canManage}
                    onClick={() => {
                      onNextAction({
                        kind: "EDIT_INVENTORY",
                        draft: {
                          materialId: material.id,
                          id: inventory.id,
                          locationName: inventory.locationName,
                          minimumStock: inventory.minimumStock,
                          lastPurchasePrice: inventory.lastPurchasePrice,
                        },
                      });
                      onClose();
                    }}
                    className="flex min-h-19 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs leading-[1.15] font-bold text-on-surface">
                        {inventory.locationName}
                      </span>
                      <span className="mt-1 block text-[10px] leading-[1.2] text-on-surface-variant">
                        Minimum {inventory.minimumStock.toLocaleString("id-ID")} · Harga acuan Rp{" "}
                        {inventory.lastPurchasePrice.toLocaleString("id-ID")}
                      </span>
                      <span className="mt-1 block text-[9px] leading-[1.2] text-on-surface-variant/70">
                        Stok {inventory.currentStock.toLocaleString("id-ID")} · Reservasi{" "}
                        {inventory.reservedStock.toLocaleString("id-ID")}
                      </span>
                    </span>
                    {canManage ? <WorkspaceRowChevron /> : null}
                  </button>
                ))}
              </div>
            </GroupedSurface>
          </section>
          {!canManage ? (
            <p className="px-1 text-[10px] leading-[1.35] text-on-surface-variant">
              Akun ini hanya dapat melihat default Material Master.
            </p>
          ) : null}
        </div>
      ) : null}
    </DetailSheet>
  );
}
