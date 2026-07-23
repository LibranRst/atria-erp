"use client";

import React from "react";

import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { ProjectCategoryPlanItemView } from "../shared/rap-rab-manager";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function PackageSetupContent({
  items,
  code,
  skipped,
  canEdit,
  isPending,
  onAdd,
  onOpen,
  onSkip,
}: {
  readonly items: readonly ProjectCategoryPlanItemView[];
  readonly code: "TUKANG" | "SUBCON";
  readonly skipped: boolean;
  readonly canEdit: boolean;
  readonly isPending: boolean;
  readonly onAdd: () => void;
  readonly onOpen: (id: string) => void;
  readonly onSkip: (skipped: boolean) => void;
}): React.JSX.Element {
  if (skipped) {
    return (
      <div className="rounded-2xl bg-surface-container-low p-md text-center">
        <p className="text-sm font-bold">Scope tidak digunakan</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Keputusan ini tersimpan untuk review dan handoff.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => onSkip(false)}
            disabled={isPending}
            className="mt-3 min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary"
          >
            Buka Kembali Scope
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <AppIcon name={code === "TUKANG" ? "engineering" : "domain"} className="text-[19px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-bold">{item.name}</span>
              <span className="block truncate text-[10px] leading-4 text-on-surface-variant">
                {item.area}
                {item.vendorName ? ` - ${item.vendorName}` : ""}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-[10px] leading-5 font-bold">
                {formatShortRp(Number(item.estimatedTotalCost))}
              </span>
              <span
                className={`block text-[9px] leading-4 font-bold ${
                  item.status === "DRAFT" ? "text-warning" : "text-primary"
                }`}
              >
                {item.status === "ACTIVE" ? "Siap" : formatBusinessLabel(item.status)}
              </span>
            </span>
          </button>
        ))}
      </div>
      {items.length === 0 && (
        <div className="rounded-2xl bg-surface-container-low p-md text-center text-xs text-on-surface-variant">
          Belum ada package untuk tahap ini.
        </div>
      )}
      {canEdit && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={isPending}
            className="min-h-12 rounded-full bg-primary text-xs font-bold text-on-primary"
          >
            Tambah Package
          </button>
          {items.length === 0 && (
            <button
              type="button"
              onClick={() => onSkip(true)}
              disabled={isPending}
              className="min-h-12 rounded-full bg-white text-xs font-bold text-on-surface-variant ring-1 ring-outline-variant/20"
            >
              Tidak Digunakan
            </button>
          )}
        </div>
      )}
      {!canEdit && (
        <p className="rounded-2xl bg-primary/5 p-3 text-[10px] leading-4 text-primary">
          Tahap ini menunggu PM, Owner, atau Finance.
        </p>
      )}
    </div>
  );
}
