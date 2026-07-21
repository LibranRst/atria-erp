"use client";

import React from "react";

import { formatStatus } from "@/components/ui/badge";
import type { RapView, MaterialOption } from "../shared/rap-rab-manager";
import type { StockMovement, TabId } from "../project-tabs";
import { LockedTabState } from "../project-tab-states";
import { StockOperationSheet } from "./stock-operation-sheet";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

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
  const { openActivityDetail } = useActivityDetail();
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
  const totalTracked = rap?.items.reduce((sum, item) => sum + item.securedQuantity, 0) || 0;

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <section className="bg-primary rounded-[28px] p-5 text-white shadow-[0_16px_38px_rgba(17,17,17,0.13)] max-[430px]:p-4">
        <p className="text-[9px] font-bold tracking-[0.16em] text-white/55 uppercase">
          Posisi material proyek
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[28px] leading-8 font-bold tabular-nums">
              {totalTracked.toLocaleString("id-ID")}
            </p>
            <p className="mt-1 text-[10px] text-white/60">
              total kebutuhan yang sudah diamankan atau terpakai
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/80">
            {rap?.items.length ?? 0} material RAP
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 pt-4">
          <QuantityFact label="Direservasi" value={reservedQty} />
          <QuantityFact label="Terpakai" value={usedQty} align="center" />
          <QuantityFact label="Tersisa" value={leftoverQty} align="right" />
        </div>
        <div className="mt-4">
          <StockOperationSheet
            projectId={projectId}
            rap={rap}
            materials={materials}
            userRole={userRole}
          />
        </div>
      </section>

      <section className="space-y-2.5">
        <header className="px-1">
          <h2 className="text-on-surface text-[17px] leading-6 font-semibold">Material proyek</h2>
          <p className="text-on-surface-variant mt-0.5 text-[11px] leading-4">
            Status stok, reservasi, dan kekurangan pengadaan per material RAP.
          </p>
        </header>
        {!rap || rap.items.length === 0 ? (
          <div className="text-on-surface-variant rounded-[22px] bg-white px-4 py-4 text-xs leading-5 shadow-[0_10px_26px_rgba(17,17,17,0.04)]">
            <span className="text-on-surface font-bold">Belum ada material.</span> Tambahkan
            material di tab RAP terlebih dahulu.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] rounded-[24px] bg-white px-4 py-2 shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025]">
            {rap.items.map((item) => {
              const shortage = item.needToBuy > 0;
              return (
                <div key={item.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-on-surface text-xs font-bold">{item.name}</p>
                      <div className="text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]">
                        <span>{item.area}</span>
                        {item.returnedQuantity > 0 && (
                          <span className="text-primary font-semibold">
                            · Dikembalikan {item.returnedQuantity} {item.unit}
                          </span>
                        )}
                        {item.wasteQuantity > 0 && (
                          <span className="text-error font-semibold">
                            · Terbuang {item.wasteQuantity} {item.unit}
                          </span>
                        )}
                      </div>
                    </div>
                    {shortage ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-600">
                        Kurang {item.needToBuy} {item.unit}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                        Terpenuhi
                      </span>
                    )}
                  </div>

                  <div></div>
                  {/*<div className="grid grid-cols-4 gap-2 text-[9px] font-medium leading-none text-on-surface-variant bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/15">
                    <div>
                      <span className="block text-[8px] uppercase tracking-wide text-on-surface-variant/60 mb-1">Required</span>
                      <span className="font-mono font-bold text-on-surface tabular-nums">{item.totalQuantity} {item.unit}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-wide text-on-surface-variant/60 mb-1">Reserved</span>
                      <span className="font-mono font-bold text-on-surface tabular-nums">{item.reservedQuantity} {item.unit}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-wide text-on-surface-variant/60 mb-1">Secured</span>
                      <span className="font-mono font-bold text-on-surface tabular-nums">{item.securedQuantity} {item.unit}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-wide text-on-surface-variant/60 mb-1">Need to Buy</span>
                      <span className={`font-mono font-bold tabular-nums ${shortage ? "text-amber-600" : "text-on-surface"}`}>{item.needToBuy} {item.unit}</span>
                    </div>
                  </div>*/}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <header className="px-1">
          <h2 className="text-on-surface text-[17px] leading-6 font-semibold">Aktivitas stok</h2>
          <p className="text-on-surface-variant mt-0.5 text-[11px] leading-4">
            Urutan reservasi, pemakaian, pengembalian, dan material terbuang.
          </p>
        </header>
        {stockMovements.length === 0 ? (
          <div className="text-on-surface-variant rounded-[22px] bg-white px-4 py-4 text-xs leading-5 shadow-[0_10px_26px_rgba(17,17,17,0.04)]">
            <span className="text-on-surface font-bold">Belum ada mutasi stok.</span> Aktivitas
            material pertama akan muncul setelah operasi stok dicatat.
          </div>
        ) : (
          <div className="rounded-[24px] bg-white px-4 py-2 shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025]">
            {stockMovements.map((move, index) => (
              <button
                type="button"
                onClick={() => openActivityDetail({ kind: "STOCK_MOVEMENT", id: move.id })}
                key={move.id}
                className="focus-visible:bg-surface-container-low active:bg-surface-container-low/70 relative flex min-h-12 w-full gap-3 py-3 text-left outline-none"
                aria-label={`Lihat detail mutasi ${move.material.name}`}
              >
                {index < stockMovements.length - 1 ? (
                  <span
                    className="bg-outline-variant/45 absolute top-11 bottom-[-12px] left-[17px] w-px"
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${movementTone(move.movementType)}`}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {move.movementType === "WASTE"
                      ? "delete"
                      : move.movementType === "RETURN"
                        ? "undo"
                        : "sync_alt"}
                  </span>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-on-surface truncate text-xs font-bold">
                        {move.material.name}
                      </p>
                      <p className="text-on-surface-variant mt-0.5 truncate text-[10px]">
                        {move.location.name} · {move.createdBy.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-on-surface font-mono text-xs font-bold tabular-nums">
                        {Number(move.quantity).toLocaleString("id-ID")} {move.material.unit}
                      </p>
                      <p className="text-on-surface-variant mt-0.5 text-[9px] font-semibold">
                        {movementLabel(move.movementType)}
                      </p>
                    </div>
                  </div>
                  <p className="text-on-surface-variant mt-1.5 text-[9px]">
                    {new Date(move.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {move.note ? (
                    <p className="text-on-surface-variant mt-1.5 text-[10px] leading-4">
                      {move.note}
                    </p>
                  ) : null}
                </div>
                <ActivityDetailChevron />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuantityFact({
  label,
  value,
  align = "left",
}: {
  readonly label: string;
  readonly value: number;
  readonly align?: "left" | "center" | "right";
}): React.JSX.Element {
  const className =
    align === "center" ? "px-2 text-center" : align === "right" ? "pl-2 text-right" : "pr-2";
  return (
    <div className={className}>
      <p className="truncate text-[8px] font-bold tracking-wide text-white/50 uppercase">{label}</p>
      <p className="mt-1 font-mono text-[13px] font-bold tabular-nums">
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  );
}
