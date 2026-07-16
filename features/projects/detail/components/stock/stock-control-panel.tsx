"use client";

import React from "react";

import { formatStatus } from "@/components/ui/badge";
import type { RapView, MaterialOption } from "../shared/rap-rab-manager";
import type { StockMovement, TabId } from "../project-tabs";
import { LockedTabState } from "../project-tab-states";
import { StockOperationSheet } from "./stock-operation-sheet";

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

function movementTone(type: string): string {
  if (type === "WASTE") return "bg-error text-white";
  if (type === "USE" || type === "STOCK_OUT") return "bg-secondary text-white";
  if (type === "RETURN" || type === "STOCK_IN") return "bg-primary text-white";
  return "bg-on-surface text-white";
}

function movementLabel(type: string): string {
  if (type === "RESERVE") return "Reservasi";
  if (type === "USE" || type === "STOCK_OUT") return "Pemakaian";
  if (type === "RETURN") return "Pengembalian";
  if (type === "WASTE") return "Material terbuang";
  if (type === "STOCK_IN") return "Stok masuk";
  return formatStatus(type);
}

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
    return <LockedTabState tabLabel="Stok" actionLabel={nextSetupLabel} actionIcon={nextSetupIcon} onAction={() => setActiveTab(nextSetupTab)} />;
  }

  const reservedQty = rap?.items.reduce((sum, item) => sum + item.reservedQuantity, 0) || 0;
  const usedQty = rap?.items.reduce((sum, item) => sum + item.usedQuantity, 0) || 0;
  const leftoverQty = rap?.items.reduce((sum, item) => sum + item.leftoverQuantity, 0) || 0;
  const totalTracked = reservedQty + usedQty + leftoverQty;

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <section className="rounded-[28px] bg-primary p-5 text-white shadow-[0_16px_38px_rgba(17,17,17,0.13)] max-[430px]:p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">Posisi material proyek</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[28px] font-bold leading-8 tabular-nums">{totalTracked.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-[10px] text-white/60">total kuantitas yang tercatat</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/80">{rap?.items.length ?? 0} material RAP</span>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 pt-4">
          <QuantityFact label="Direservasi" value={reservedQty} />
          <QuantityFact label="Terpakai" value={usedQty} align="center" />
          <QuantityFact label="Tersisa" value={leftoverQty} align="right" />
        </div>
        <div className="mt-4">
          <StockOperationSheet projectId={projectId} rap={rap} materials={materials} userRole={userRole} />
        </div>
      </section>

      <section className="space-y-2.5">
        <header className="px-1">
          <h2 className="text-[17px] font-semibold leading-6 text-on-surface">Aktivitas stok</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">Urutan reservasi, pemakaian, pengembalian, dan material terbuang.</p>
        </header>
        {stockMovements.length === 0 ? (
          <div className="rounded-[22px] bg-white px-4 py-4 text-xs leading-5 text-on-surface-variant shadow-[0_10px_26px_rgba(17,17,17,0.04)]">
            <span className="font-bold text-on-surface">Belum ada mutasi stok.</span> Aktivitas material pertama akan muncul setelah operasi stok dicatat.
          </div>
        ) : (
          <div className="rounded-[24px] bg-white px-4 py-2 shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025]">
            {stockMovements.map((move, index) => (
              <div key={move.id} className="relative flex gap-3 py-3">
                {index < stockMovements.length - 1 ? <span className="absolute left-[17px] top-11 bottom-[-12px] w-px bg-outline-variant/45" aria-hidden="true" /> : null}
                <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${movementTone(move.movementType)}`}>
                  <span className="material-symbols-outlined text-[17px]">{move.movementType === "WASTE" ? "delete" : move.movementType === "RETURN" ? "undo" : "sync_alt"}</span>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-on-surface">{move.material.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">{move.location.name} · {move.createdBy.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-bold tabular-nums text-on-surface">{Number(move.quantity).toLocaleString("id-ID")} {move.material.unit}</p>
                      <p className="mt-0.5 text-[9px] font-semibold text-on-surface-variant">{movementLabel(move.movementType)}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[9px] text-on-surface-variant">{new Date(move.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  {move.note ? <p className="mt-1.5 text-[10px] leading-4 text-on-surface-variant">{move.note}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuantityFact({ label, value, align = "left" }: { readonly label: string; readonly value: number; readonly align?: "left" | "center" | "right" }): React.JSX.Element {
  const className = align === "center" ? "px-2 text-center" : align === "right" ? "pl-2 text-right" : "pr-2";
  return <div className={className}><p className="truncate text-[8px] font-bold uppercase tracking-wide text-white/50">{label}</p><p className="mt-1 font-mono text-[13px] font-bold tabular-nums">{value.toLocaleString("id-ID")}</p></div>;
}
