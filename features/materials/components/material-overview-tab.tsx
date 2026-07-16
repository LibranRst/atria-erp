"use client";

import React from "react";

import type {
  MaterialMovementView,
  MaterialOperationsDashboard,
} from "@/app/actions/material/operations-dashboard";
import { MoneyValue } from "@/components/ui/page-primitives";
import type { MaterialOperationDecision } from "@/features/materials/components/material-dashboard-types";
import {
  MaterialGroupSurface,
  MaterialInlineState,
  MaterialSection,
  MaterialTextAction,
  type MaterialTone,
} from "@/features/materials/components/material-page-primitives";
import {
  ApprovalRow,
  MovementRow,
} from "@/features/materials/components/material-operation-sheets";
import type { MaterialTab } from "@/features/materials/lib/material-ui-utils";

type OverviewTabProps = {
  readonly data: MaterialOperationsDashboard;
  readonly totalStockValue: number;
  readonly availableValue: number;
  readonly lowCount: number;
  readonly pendingApprovals: number;
  readonly movements: readonly MaterialMovementView[];
  readonly onDecision: (decision: MaterialOperationDecision) => void;
  readonly onNavigate: (tab: MaterialTab) => void;
};

type AttentionItem = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly value: number;
  readonly icon: string;
  readonly tone: MaterialTone;
  readonly tab: MaterialTab;
};

export function MaterialOverviewTab({
  data,
  totalStockValue,
  availableValue,
  lowCount,
  pendingApprovals,
  movements,
  onDecision,
  onNavigate,
}: OverviewTabProps): React.JSX.Element {
  const shortageCount = data.shortages.filter((row) => row.needToBuy > 0).length;
  const reservedValue = Math.max(totalStockValue - availableValue, 0);
  const availableRatio = totalStockValue > 0
    ? Math.min(Math.max((availableValue / totalStockValue) * 100, 0), 100)
    : 0;
  const attention: readonly AttentionItem[] = [
    ...(shortageCount > 0 ? [{
      id: "shortage",
      title: "Kebutuhan RAP belum terpenuhi",
      detail: `${shortageCount} material perlu ditutup sebelum pekerjaan dilanjutkan.`,
      value: shortageCount,
      icon: "production_quantity_limits",
      tone: "critical" as const,
      tab: "needs" as const,
    }] : []),
    ...(lowCount > 0 ? [{
      id: "low-stock",
      title: "Stok menyentuh batas minimum",
      detail: `${lowCount} material perlu diperiksa sebelum reservasi berikutnya.`,
      value: lowCount,
      icon: "inventory_2",
      tone: "warning" as const,
      tab: "inventory" as const,
    }] : []),
    ...(pendingApprovals > 0 ? [{
      id: "approval",
      title: "Keputusan stok menunggu",
      detail: `${pendingApprovals} dokumen belum mengubah posisi stok.`,
      value: pendingApprovals,
      icon: "approval",
      tone: "pending" as const,
      tab: "overview" as const,
    }] : []),
  ].slice(0, 3);

  const pendingCounts = data.counts.filter((row) => row.status === "PENDING_APPROVAL");
  const pendingReceipts = data.receipts.filter((row) => row.status === "REVERSAL_REQUESTED");

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <section
        className="relative isolate overflow-hidden rounded-[30px] bg-[#151719] px-5 py-5 text-white shadow-[0_2px_4px_rgba(17,17,17,0.12),0_20px_48px_rgba(17,17,17,0.16)] ring-1 ring-white/[0.08] max-[430px]:rounded-[26px] max-[430px]:px-4 max-[430px]:py-4"
        aria-label="Posisi stok"
      >
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20" aria-hidden="true" />
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/52">Nilai stok</p>
        <MoneyValue
          amount={totalStockValue}
          variant="fullDynamic"
          tone="inverse"
          size="hero"
          className="mt-1.5"
        />

        <div className="mt-5 rounded-[22px] bg-white/[0.075] p-3.5 ring-1 ring-white/[0.06] max-[430px]:mt-4 max-[430px]:rounded-[20px] max-[430px]:p-3">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide text-white/50">Siap dipakai</p>
              <MoneyValue amount={availableValue} variant="compactWithFull" tone="inverse" size="lg" className="mt-1" />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-bold uppercase tracking-wide text-white/50">Terikat / reserved</p>
              <MoneyValue amount={reservedValue} variant="compactWithFull" tone="inverse" align="right" size="sm" className="mt-1" />
            </div>
          </div>
          <StockAvailabilitySplit value={availableRatio} />
          <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-semibold text-white/58">
            <span>{availableRatio.toFixed(1)}% dapat digunakan</span>
            <span>{lowCount} perlu perhatian</span>
          </div>
        </div>
      </section>

      <MaterialSection title="Perlu perhatian" meta={attention.length > 0 ? `${attention.length} prioritas` : "Terkendali"}>
        <MaterialGroupSurface>
          {attention.length === 0 ? (
            <MaterialInlineState
              icon="check_circle"
              title="Tidak ada perhatian mendesak"
              description="Kebutuhan RAP, batas minimum, dan keputusan stok saat ini terkendali."
              tone="positive"
            />
          ) : (
            <div className="divide-y divide-black/[0.055] px-3">
              {attention.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="flex min-h-[72px] w-full items-center gap-3 px-1 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${attentionIconClass(item.tone)}`}>
                    <span className="material-symbols-outlined text-[17px]" aria-hidden="true">{item.icon}</span>
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate text-[13px] font-bold leading-4 text-on-surface">{item.title}</span>
                    <span className="truncate text-[10px] leading-[1.3] text-on-surface-variant">{item.detail}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] font-black tabular-nums text-on-surface">{item.value}</span>
                  <span className="material-symbols-outlined shrink-0 text-[18px] text-[#007AFF]" aria-hidden="true">chevron_right</span>
                </button>
              ))}
            </div>
          )}
        </MaterialGroupSurface>
      </MaterialSection>

      {pendingApprovals > 0 ? (
        <MaterialSection title="Perlu keputusan" meta={`${pendingApprovals} menunggu`}>
          <MaterialGroupSurface>
            <div className="divide-y divide-black/[0.055]">
              {pendingCounts.map((row) => (
                <ApprovalRow
                  key={row.id}
                  title={row.countNumber}
                  description={`${row.locationName} · ${row.items.length} material · stock opname`}
                  onApprove={() => onDecision({ type: "COUNT_APPROVE", id: row.id })}
                  onReject={() => onDecision({ type: "COUNT_REJECT", id: row.id })}
                />
              ))}
              {pendingReceipts.map((row) => (
                <ApprovalRow
                  key={row.id}
                  title={`Pembatalan ${row.receiptNumber}`}
                  description={`${row.projectName} · penerimaan akan dikembalikan`}
                  amount={row.total}
                  onApprove={() => onDecision({ type: "RECEIPT_APPROVE", id: row.id })}
                  onReject={() => onDecision({ type: "RECEIPT_REJECT", id: row.id })}
                />
              ))}
            </div>
          </MaterialGroupSurface>
        </MaterialSection>
      ) : null}

      <MaterialSection
        title="Aktivitas terbaru"
        meta={movements.length > 0 ? `${Math.min(movements.length, 5)} terbaru` : undefined}
        action={movements.length > 0 ? <MaterialTextAction label="Lihat semua" onClick={() => onNavigate("activity")} /> : undefined}
      >
        <MaterialGroupSurface>
          {movements.length === 0 ? (
            <MaterialInlineState
              icon="history"
              title="Belum ada pergerakan stok"
              description="Penerimaan, pemakaian, transfer, dan penyesuaian akan muncul di sini."
            />
          ) : (
            <div className="divide-y divide-black/[0.055] px-3">
              {movements.slice(0, 5).map((row) => <MovementRow key={row.id} row={row} />)}
            </div>
          )}
        </MaterialGroupSurface>
      </MaterialSection>
    </div>
  );
}

function StockAvailabilitySplit({ value }: { readonly value: number }): React.JSX.Element {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className="mt-3" aria-label={`Stok siap dipakai ${value.toFixed(1)} persen`}>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.12] ring-1 ring-white/[0.05]">
        <span className="h-full bg-white" style={{ width: `${clamped}%` }} aria-hidden="true" />
        <span className="h-full flex-1 bg-white/[0.18]" aria-hidden="true" />
      </div>
      <div className="mt-1.5 flex justify-between text-[8px] font-bold uppercase tracking-wide text-white/45">
        <span>Siap dipakai</span>
        <span>Terikat</span>
      </div>
    </div>
  );
}

function attentionIconClass(tone: MaterialTone): string {
  if (tone === "critical") return "bg-error/[0.08] text-error ring-1 ring-error/[0.06]";
  if (tone === "warning") return "bg-warning/[0.09] text-warning ring-1 ring-warning/[0.06]";
  if (tone === "pending") return "bg-primary/[0.08] text-primary ring-1 ring-primary/[0.06]";
  return "bg-surface-container text-on-surface-variant";
}
