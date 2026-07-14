"use client";

import React from "react";
import { LockedTabState } from "../project-tab-states";
import { StockOperationSheet } from "./stock-operation-sheet";
import {
  MetricGrid,
  MetricPill,
  NativeSection,
} from "@/components/ui/page-primitives";
import { formatStatus } from "@/components/ui/badge";
import type { RapView, MaterialOption } from "../shared/rap-rab-manager";
import type { StockMovement, TabId } from "../project-tabs";

interface StockControlPanelProps {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly materials: readonly MaterialOption[];
  readonly stockMovements: readonly StockMovement[];
  readonly userRole: string;
  readonly isLocked: boolean;
  readonly nextSetupTab: TabId;
  readonly nextSetupLabel: string;
  readonly nextSetupIcon: string;
  readonly setActiveTab: (tab: TabId) => void;
}

const getMovementBadgeColor = (type: string) => {
  switch (type) {
    case "STOCK_IN":
      return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
    case "STOCK_OUT":
    case "USE":
      return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    case "RESERVE":
      return "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20";
    case "RETURN":
      return "bg-sky-500/10 text-sky-500 border border-sky-500/20";
    default:
      return "bg-slate-500/10 text-slate-500 border border-slate-500/20";
  }
};

export function StockControlPanel({
  projectId,
  rap,
  materials,
  stockMovements,
  userRole,
  isLocked,
  nextSetupTab,
  nextSetupLabel,
  nextSetupIcon,
  setActiveTab,
}: StockControlPanelProps): React.JSX.Element {
  if (isLocked) {
    return (
      <LockedTabState
        tabLabel="Stok"
        actionLabel={nextSetupLabel}
        actionIcon={nextSetupIcon}
        onAction={() => setActiveTab(nextSetupTab)}
      />
    );
  }

  const reservedQty = rap?.items.reduce((sum, item) => sum + item.reservedQuantity, 0) || 0;
  const usedQty = rap?.items.reduce((sum, item) => sum + item.usedQuantity, 0) || 0;
  const leftoverQty = rap?.items.reduce((sum, item) => sum + item.leftoverQuantity, 0) || 0;

  return (
    <div className="space-y-sm">
      <NativeSection
        eyebrow="Stock Control"
        title="Status Persediaan Material"
      >
        <MetricGrid balanceLastRow>
          <MetricPill
            label="Reserved"
            value={`${reservedQty}`}
          />
          <MetricPill
            label="Used"
            value={`${usedQty}`}
            tone="muted"
          />
          <MetricPill
            label="Leftover"
            value={`${leftoverQty}`}
          />
        </MetricGrid>
        <div className="mt-sm">
          <StockOperationSheet
            projectId={projectId}
            rap={rap}
            materials={materials}
            userRole={userRole}
          />
        </div>
      </NativeSection>

      <NativeSection
        eyebrow="Inventory Activity"
        title="Mutasi Stok Proyek"
      >
        {stockMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container-low px-md py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-on-surface shadow-sm">
              <span className="material-symbols-outlined text-[24px]">
                inventory_2
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-on-surface">
              Belum ada mutasi stok.
            </p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-on-surface-variant">
              Aktivitas reserve, usage, return, dan adjustment akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/35 max-h-[440px] overflow-y-auto overflow-hidden rounded-2xl bg-surface-container-low pr-1">
            {stockMovements.map((move) => (
              <div key={move.id} className="flex gap-3 p-sm text-xs">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getMovementBadgeColor(move.movementType)}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    sync_alt
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-on-surface">
                        {move.material.name}
                      </p>
                      <p className="truncate text-[10px] text-on-surface-variant">
                        {move.location.name} • {move.createdBy.name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white border border-outline-variant/20 px-2 py-0.5 text-[9px] font-bold text-on-surface">
                      {formatStatus(move.movementType)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="font-mono font-bold text-on-surface">
                      {Number(move.quantity).toLocaleString("id-ID")}{" "}
                      {move.material.unit}
                    </span>
                    <span className="text-[9px] text-on-surface-variant">
                      {new Date(move.createdAt).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                  {move.note && (
                    <p className="mt-2 rounded-xl bg-white/70 p-2 text-[10px] italic text-on-surface-variant">
                      &quot;{move.note}&quot;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </NativeSection>
    </div>
  );
}
