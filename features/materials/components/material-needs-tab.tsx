"use client";

import Link from "next/link";
import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  MaterialGroupSurface,
  MaterialInlineState,
  MaterialSection,
  MaterialStatusLabel,
} from "@/features/materials/components/material-page-primitives";
import { formatMaterialQuantity } from "@/features/materials/lib/material-ui-utils";

type NeedsTabProps = {
  readonly data: MaterialOperationsDashboard;
};

export function MaterialNeedsTab({ data }: NeedsTabProps): React.JSX.Element {
  const shortages = data.shortages.filter((row) => row.needToBuy > 0);
  const anchors = Array.from(new Map(shortages.map((row) => [row.projectRapId, row])).values());
  const totalEstimate = shortages.reduce((sum, row) => sum + row.estimatedTotalCost, 0);

  if (shortages.length === 0) {
    return (
      <MaterialGroupSurface>
        <MaterialInlineState
          icon="check_circle"
          title="Semua kebutuhan RAP terpenuhi"
          description="Stok tersedia saat ini cukup untuk menutup kebutuhan material project aktif."
          tone="positive"
        />
      </MaterialGroupSurface>
    );
  }

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <section className="relative isolate overflow-hidden rounded-[24px] bg-white/[0.92] p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_12px_28px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025] backdrop-blur-xl max-[430px]:rounded-[22px] max-[430px]:p-3.5" aria-label="Posisi kebutuhan material">
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-warning/[0.09] text-warning ring-1 ring-warning/[0.06]">
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">production_quantity_limits</span>
            </span>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/60">Kebutuhan belum tertutup</p>
          </div>
          <MaterialStatusLabel label="Perlu dibeli" tone="warning" />
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[26px] font-black leading-7 tabular-nums text-on-surface">{shortages.length}</p>
            <p className="mt-1 text-[10px] font-semibold leading-[1.3] text-on-surface-variant">material pada {anchors.length} project</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[8px] font-bold uppercase tracking-wide text-on-surface-variant/60">Estimasi pengadaan</p>
            <MoneyValue amount={totalEstimate} variant="compactWithFull" align="right" size="lg" className="mt-1" />
          </div>
        </div>
      </section>

      <MaterialSection title="Per project" meta={`${anchors.length} terdampak`}>
        <div className="space-y-3">
          {anchors.map((anchor) => {
            const rows = shortages.filter((row) => row.projectRapId === anchor.projectRapId);
            const projectEstimate = rows.reduce((sum, row) => sum + row.estimatedTotalCost, 0);
            const project = data.projects.find((item) =>
              item.rapItems.some((rapItem) => rows.some((row) => row.projectRapItemId === rapItem.id)),
            );
            return (
              <MaterialGroupSurface key={anchor.projectRapId}>
                <div className="flex items-start justify-between gap-3 px-3.5 py-3.5">
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="line-clamp-2 text-[14px] font-bold leading-[1.12] text-on-surface">{project?.name ?? "Project material"}</p>
                    <p className="text-[10px] leading-[1.3] text-on-surface-variant">{rows.length} material belum tertutup · estimasi pengadaan</p>
                  </div>
                  <MoneyValue amount={projectEstimate} variant="compactWithFull" align="right" size="sm" />
                </div>

                <div className="divide-y divide-black/[0.055] border-t border-black/[0.055] px-3">
                  {rows.map((row) => (
                    <div key={row.projectRapItemId} className="flex min-h-[76px] items-center gap-3 px-0.5 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/[0.09] text-warning ring-1 ring-warning/[0.06]">
                        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">shopping_cart_checkout</span>
                      </span>
                      <div className="grid min-w-0 flex-1 gap-1">
                        <p className="truncate text-[13px] font-bold leading-4 text-on-surface">{row.materialName}</p>
                        <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">{row.area} · tersedia {formatMaterialQuantity(row.availableStock)} dari {formatMaterialQuantity(row.totalQuantity)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[12px] font-black leading-4 tabular-nums text-warning">Kurang {formatMaterialQuantity(row.needToBuy)}</p>
                        <MoneyValue amount={row.estimatedTotalCost} variant="compactWithFull" align="right" size="xs" className="mt-1" />
                      </div>
                    </div>
                  ))}
                </div>

                {project && data.roleName !== "PURCHASING" ? (
                  <div className="border-t border-black/[0.055] px-3.5 py-2.5">
                    <Link
                      href={`/projects/${project.id}?tab=rap`}
                      className="flex min-h-12 w-full items-center justify-center gap-1 rounded-full bg-[#007AFF]/[0.08] px-5 text-[11px] font-bold text-[#007AFF] outline-none active:bg-[#007AFF]/[0.14] focus-visible:ring-2 focus-visible:ring-[#007AFF]/30"
                    >
                      Buka RAP project
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_right</span>
                    </Link>
                  </div>
                ) : null}
              </MaterialGroupSurface>
            );
          })}
        </div>
      </MaterialSection>
    </div>
  );
}
