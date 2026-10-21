"use client";

import React from "react";

import { AppIcon, formatStatus, PageState, StatusBadge } from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { ProjectStockDesktop } from "./project-stock-desktop";
import { ProjectStockMobileSummary } from "./project-stock-mobile-summary";
import type { ProjectOperationsSource, ProjectStockRap } from "./project-stock-types";
import type { RapView, MaterialOption } from "../shared/rap-rab-manager";
import type { StockMovement, TabId } from "../shared/project-tabs";
import { LockedTabState } from "../shared/project-tab-states";
import { StockOperationSheet } from "./stock-operation-sheet";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";
import { cn } from "@/lib/utils/cn";
export interface StockControlPanelProps {
  readonly stockRap?: ProjectStockRap | null;
  readonly source?: ProjectOperationsSource;
  readonly onWorkflowActiveChange?: (active: boolean) => void;
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly materials: readonly MaterialOption[];
  readonly stockMovements: readonly StockMovement[];
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
  rap: legacyRap,
  stockRap,
  source,
  onWorkflowActiveChange,
  materials,
  stockMovements,
  isLocked,
  nextSetupTab,
  nextSetupLabel,
  nextSetupIcon,
  setActiveTab,
}: StockControlPanelProps): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const desktop = useWorkspacePresentation() === "desktop";
  const rap = stockRap === undefined ? legacyRap : stockRap;
  const stockSource: ProjectOperationsSource = source ?? { status: rap ? "ready" : "missing" };
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

  const materialSourceKnown = stockSource.status === "ready" || stockSource.status === "missing";

  return (
    <div className="relative min-w-0 space-y-sm">
      <section
        className={
          desktop || !materialSourceKnown
            ? "contents"
            : "rounded-owner bg-primary p-5 text-white shadow-inverse max-[430px]:p-4"
        }
      >
        <div hidden={desktop || !materialSourceKnown} inert={desktop || !materialSourceKnown}>
          <ProjectStockMobileSummary items={rap?.items ?? []} />
        </div>
        <div className={desktop ? "absolute top-0 right-0 z-10" : "mt-4"}>
          <StockOperationSheet
            projectId={projectId}
            rap={stockSource.status === "ready" ? rap : null}
            materials={materials}
            onWorkflowActiveChange={onWorkflowActiveChange}
          />
        </div>
      </section>

      <div hidden={desktop} inert={desktop} className="space-y-sm">
        {stockSource.status === "restricted" || stockSource.status === "unavailable" ? (
          <PageState
            kind={stockSource.status === "restricted" ? "restricted" : "error"}
            title={
              stockSource.status === "restricted"
                ? "Akses stok dibatasi"
                : "Posisi material belum tersedia"
            }
            description={
              stockSource.message ??
              "Data stok belum dapat dibaca. Segarkan halaman untuk mencoba lagi."
            }
            compact
          />
        ) : (
          <section className="space-y-2.5">
            <header className="px-1">
              <h2 className="text-title font-semibold text-on-surface">Material proyek</h2>
              <p className="mt-0.5 text-support text-on-surface-variant">
                Status stok, reservasi, dan kekurangan pengadaan per material RAP.
              </p>
            </header>
            {!rap || rap.items.length === 0 ? (
              <div className="rounded-[22px] bg-white px-4 py-4 text-xs leading-5 text-on-surface-variant shadow-surface">
                <span className="font-bold text-on-surface">Belum ada material.</span> Tambahkan
                material di tab RAP terlebih dahulu.
              </div>
            ) : (
              <div className="divide-y divide-black/4 rounded-3xl bg-white px-4 py-2 shadow-surface ring-1 ring-ring-subtle">
                {rap.items.map((item) => {
                  const shortage = item.needToBuy > 0;
                  return (
                    <div key={item.id} className="flex flex-col gap-2 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs leading-5 font-bold text-on-surface">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta text-on-surface-variant">
                            <span>{item.area}</span>
                            {item.returnedQuantity > 0 && (
                              <span className="font-semibold text-primary">
                                · Dikembalikan {item.returnedQuantity} {item.unit}
                              </span>
                            )}
                            {item.wasteQuantity > 0 && (
                              <span className="font-semibold text-error">
                                · Terbuang {item.wasteQuantity} {item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        {shortage ? (
                          <StatusBadge
                            tone="warning"
                            label={`Kurang ${item.needToBuy} ${item.unit}`}
                          />
                        ) : (
                          <StatusBadge tone="healthy" label="Terpenuhi" />
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] leading-5 tracking-wide text-on-surface-variant/60 uppercase">
                            Required
                          </span>
                          <div className="flex flex-row items-center justify-center gap-1.5 rounded-xl bg-surface-container-low p-3 font-mono leading-4 font-bold text-on-surface tabular-nums">
                            {item.totalQuantity} <span className="text-[10px]">{item.unit}</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] leading-5 tracking-wide text-on-surface-variant/60 uppercase">
                            Reserved
                          </span>
                          <div className="flex flex-row items-center justify-center gap-1.5 rounded-xl bg-surface-container-low p-3 font-mono leading-4 font-bold text-on-surface tabular-nums">
                            {item.reservedQuantity} <span className="text-[10px]">{item.unit}</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] leading-5 tracking-wide text-on-surface-variant/60 uppercase">
                            Secured
                          </span>
                          <div className="flex flex-row items-center justify-center gap-1.5 rounded-xl bg-surface-container-low p-3 font-mono leading-4 font-bold text-on-surface tabular-nums">
                            {item.securedQuantity} <span className="text-[10px]">{item.unit}</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] leading-5 tracking-wide text-on-surface-variant/60 uppercase">
                            Need to Buy
                          </span>
                          <div
                            className={cn(
                              "flex flex-row items-center justify-center gap-1.5 rounded-xl bg-surface-container-low p-3 font-mono leading-4 font-bold text-on-surface tabular-nums",
                              shortage ? "text-warning" : "text-on-surface",
                            )}
                          >
                            {item.needToBuy} <span className="text-meta">{item.unit}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section hidden={!materialSourceKnown} inert={!materialSourceKnown} className="space-y-2.5">
          <header className="px-1">
            <h2 className="text-title font-semibold text-on-surface">Aktivitas stok</h2>
            <p className="mt-0.5 text-support text-on-surface-variant">
              Urutan reservasi, pemakaian, pengembalian, dan material terbuang.
            </p>
          </header>
          {stockMovements.length === 0 ? (
            <div className="rounded-[22px] bg-white px-4 py-4 text-xs leading-5 text-on-surface-variant shadow-surface">
              <span className="font-bold text-on-surface">Belum ada mutasi stok.</span> Aktivitas
              material pertama akan muncul setelah operasi stok dicatat.
            </div>
          ) : (
            <div className="rounded-3xl bg-white px-1 py-1 shadow-surface ring-1 ring-ring-subtle">
              {stockMovements.map((move, index) => (
                <button
                  type="button"
                  onClick={() => openActivityDetail({ kind: "STOCK_MOVEMENT", id: move.id })}
                  key={move.id}
                  className="relative flex min-h-12 w-full gap-3 rounded-3xl px-2 py-3 text-left transition-all outline-none focus-visible:bg-surface-container-low active:z-10 active:scale-[1.05] active:bg-surface-container-low/80 active:shadow-raised"
                  aria-label={`Lihat detail mutasi ${move.material.name}`}
                >
                  {index < stockMovements.length - 1 ? (
                    <span
                      className="absolute top-11 -bottom-sm left-4.25 w-px bg-outline-variant/45"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${movementTone(move.movementType)}`}
                  >
                    <AppIcon
                      name={
                        move.movementType === "WASTE"
                          ? "delete"
                          : move.movementType === "RETURN"
                            ? "undo"
                            : "sync_alt"
                      }
                      className="text-[17px]"
                    />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs leading-5 font-bold text-on-surface">
                          {move.material.name}
                        </p>
                        <p className="truncate text-meta text-on-surface-variant">
                          {move.location.name} · {move.createdBy.name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs leading-5 font-bold text-on-surface tabular-nums">
                          {Number(move.quantity).toLocaleString("id-ID")} {move.material.unit}
                        </p>
                        <p className="text-[9px] leading-4 font-semibold text-on-surface-variant">
                          {movementLabel(move.movementType)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-eyebrow text-on-surface-variant">
                      {new Date(move.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {move.note ? (
                      <p className="rounded-xl bg-surface-container-low p-2 text-meta text-on-surface-variant ring-ring-subtle">
                        {move.note}
                      </p>
                    ) : null}
                  </div>
                  <ActivityDetailChevron className="mt-2" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      <div hidden={!desktop} inert={!desktop}>
        <ProjectStockDesktop
          rap={rap}
          source={stockSource}
          stockMovements={stockMovements}
          onActivityOpen={(id): void => openActivityDetail({ kind: "STOCK_MOVEMENT", id })}
        />
      </div>
    </div>
  );
}
