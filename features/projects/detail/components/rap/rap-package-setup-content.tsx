"use client";

import React from "react";

import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { ProjectCategoryPlanItemView } from "../shared/rap-rab-manager";

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
      <div className="bg-surface-container-low p-md rounded-2xl text-center">
        <p className="text-sm font-bold">Scope tidak digunakan</p>
        <p className="text-on-surface-variant mt-1 text-xs">
          Keputusan ini tersimpan untuk review dan handoff.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => onSkip(false)}
            disabled={isPending}
            className="text-primary mt-3 min-h-12 w-full rounded-full bg-white text-xs font-bold"
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
            className="bg-surface-container-low flex min-h-16 w-full items-center gap-3 rounded-2xl p-3 text-left"
          >
            <span className="text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
              <span className="material-symbols-outlined text-[19px]">
                {code === "TUKANG" ? "engineering" : "domain"}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-bold">{item.name}</span>
              <span className="text-on-surface-variant block truncate text-[10px] leading-4">
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
        <div className="bg-surface-container-low p-md text-on-surface-variant rounded-2xl text-center text-xs">
          Belum ada package untuk tahap ini.
        </div>
      )}
      {canEdit && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={isPending}
            className="bg-primary text-on-primary min-h-12 rounded-full text-xs font-bold"
          >
            Tambah Package
          </button>
          {items.length === 0 && (
            <button
              type="button"
              onClick={() => onSkip(true)}
              disabled={isPending}
              className="text-on-surface-variant ring-outline-variant/20 min-h-12 rounded-full bg-white text-xs font-bold ring-1"
            >
              Tidak Digunakan
            </button>
          )}
        </div>
      )}
      {!canEdit && (
        <p className="bg-primary/5 text-primary rounded-2xl p-3 text-[10px] leading-4">
          Tahap ini menunggu PM, Owner, atau Finance.
        </p>
      )}
    </div>
  );
}
