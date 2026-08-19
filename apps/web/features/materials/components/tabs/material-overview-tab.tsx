"use client";

import React from "react";

import type {
  MaterialMovementView,
  MaterialOperationsDashboard,
} from "@/app/actions/material/operations-dashboard";
import {
  AppIcon,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  MoneyValue,
  SectionAction,
} from "@/components/ui";
import type { MaterialOperationDecision } from "@/features/materials/types/material-dashboard-types";
import type { MaterialTone } from "@/features/materials/components/shared/material-page-primitives";
import {
  ApprovalRow,
  MovementRow,
} from "@/features/materials/components/sheets/material-operation-sheets";
import type { MaterialTab } from "@/features/materials/utils/material-ui-utils";
import { ActivityDetailSheet } from "@/features/activity-detail/components/activity-detail-sheet";
import type { ActivityDetailRequest } from "@atria/core/activity-detail/types";

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

type PendingDecisionDetail = {
  readonly target: ActivityDetailRequest;
  readonly approve: MaterialOperationDecision;
  readonly reject: MaterialOperationDecision;
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
  const [detailTarget, setDetailTarget] = React.useState<ActivityDetailRequest | null>(null);
  const [presentedDecision, setPresentedDecision] = React.useState<PendingDecisionDetail | null>(
    null,
  );
  const decisionAfterCloseRef = React.useRef<MaterialOperationDecision | null>(null);

  function openDecisionDetail(detail: PendingDecisionDetail): void {
    decisionAfterCloseRef.current = null;
    setPresentedDecision(detail);
    setDetailTarget(detail.target);
  }

  function requestDecisionFromDetail(decision: MaterialOperationDecision): void {
    decisionAfterCloseRef.current = decision;
    setDetailTarget(null);
  }

  function finishDetailExit(): void {
    setPresentedDecision(null);
    const nextDecision = decisionAfterCloseRef.current;
    decisionAfterCloseRef.current = null;
    if (nextDecision) onDecision(nextDecision);
  }

  const shortageCount = data.shortages.filter((row) => row.needToBuy > 0).length;
  const reservedValue = Math.max(totalStockValue - availableValue, 0);
  const availableRatio =
    totalStockValue > 0 ? Math.min(Math.max((availableValue / totalStockValue) * 100, 0), 100) : 0;
  const attention: readonly AttentionItem[] = [
    ...(shortageCount > 0
      ? [
          {
            id: "shortage",
            title: "Kebutuhan RAP belum terpenuhi",
            detail: `${shortageCount} material perlu ditutup sebelum pekerjaan dilanjutkan.`,
            value: shortageCount,
            icon: "production_quantity_limits",
            tone: "critical" as const,
            tab: "needs" as const,
          },
        ]
      : []),
    ...(lowCount > 0
      ? [
          {
            id: "low-stock",
            title: "Stok menyentuh batas minimum",
            detail: `${lowCount} material perlu diperiksa sebelum reservasi berikutnya.`,
            value: lowCount,
            icon: "inventory_2",
            tone: "warning" as const,
            tab: "inventory" as const,
          },
        ]
      : []),
    ...(pendingApprovals > 0
      ? [
          {
            id: "approval",
            title: "Keputusan stok menunggu",
            detail: `${pendingApprovals} dokumen belum mengubah posisi stok.`,
            value: pendingApprovals,
            icon: "approval",
            tone: "pending" as const,
            tab: "overview" as const,
          },
        ]
      : []),
  ].slice(0, 3);

  const pendingCounts = data.counts.filter((row) => row.status === "PENDING_APPROVAL");
  const pendingReceipts = data.receipts.filter((row) => row.status === "REVERSAL_REQUESTED");

  return (
    <div className="space-y-sm">
      <section
        className="relative isolate overflow-hidden rounded-owner bg-surface-inverse px-5 py-5 text-white shadow-inverse ring-1 ring-white/8 max-[430px]:px-4 max-[430px]:py-4"
        aria-label="Posisi stok"
      >
        <span
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20"
          aria-hidden="true"
        />
        <p className="text-eyebrow font-bold tracking-[0.18em] text-white/52 uppercase">
          Nilai stok
        </p>
        <MoneyValue
          amount={totalStockValue}
          variant="fullDynamic"
          tone="inverse"
          size="hero"
          className="mt-1.5"
        />

        <div className="mt-5 rounded-inset bg-white/7.5 p-3.5 ring-1 ring-white/6 max-[430px]:mt-4 max-[430px]:p-3">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-eyebrow font-bold tracking-wide text-white/50 uppercase">
                Siap dipakai
              </p>
              <MoneyValue
                amount={availableValue}
                variant="compact"
                tone="inverse"
                size="lg"
                className="mt-1"
              />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-eyebrow font-bold tracking-wide text-white/50 uppercase">
                Terikat / reserved
              </p>
              <MoneyValue
                amount={reservedValue}
                variant="compact"
                tone="inverse"
                align="right"
                size="sm"
                className="mt-1"
              />
            </div>
          </div>
          <StockAvailabilitySplit value={availableRatio} />
          <div className="mt-3 flex items-center justify-between gap-3 text-meta font-semibold text-white/58">
            <span>{availableRatio.toFixed(1)}% dapat digunakan</span>
            <span>{lowCount} perlu perhatian</span>
          </div>
        </div>
      </section>

      <MainSection
        title="Perlu perhatian"
        count={attention.length > 0 ? attention.length : undefined}
        countLabel="Prioritas"
        meta={attention.length === 0 ? "Terkendali" : undefined}
      >
        <GroupedSurface>
          {attention.length === 0 ? (
            <InlineStateRow
              icon="check_circle"
              title="Tidak ada perhatian mendesak"
              description="Kebutuhan RAP, batas minimum, dan keputusan stok saat ini terkendali."
              tone="positive"
            />
          ) : (
            <div className="divide-y divide-black/5.5 px-3">
              {attention.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="flex min-h-18 w-full items-center gap-3 px-1 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${attentionIconClass(item.tone)}`}
                  >
                    <AppIcon name={item.icon} className="text-[17px]" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate text-row font-bold text-on-surface">
                      {item.title}
                    </span>
                    <span className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
                      {item.detail}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-row font-black text-on-surface tabular-nums">
                    {item.value}
                  </span>
                  <AppIcon name="chevron_right" className="icon-md shrink-0 text-accent" />
                </button>
              ))}
            </div>
          )}
        </GroupedSurface>
      </MainSection>

      {pendingApprovals > 0 ? (
        <MainSection title="Perlu keputusan" count={pendingApprovals} countLabel="Keputusan">
          <GroupedSurface>
            <div className="divide-y divide-black/5.5">
              {pendingCounts.map((row) => (
                <ApprovalRow
                  key={row.id}
                  title={row.countNumber}
                  description={`${row.locationName} · ${row.items.length} material · stock opname`}
                  detailLabel={`Lihat detail keputusan stock opname ${row.countNumber}`}
                  onOpen={() =>
                    openDecisionDetail({
                      target: { kind: "STOCK_COUNT", id: row.id },
                      approve: { type: "COUNT_APPROVE", id: row.id },
                      reject: { type: "COUNT_REJECT", id: row.id },
                    })
                  }
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
                  detailLabel={`Lihat detail keputusan pembatalan ${row.receiptNumber}`}
                  onOpen={() =>
                    openDecisionDetail({
                      target: { kind: "GOODS_RECEIPT", id: row.id },
                      approve: { type: "RECEIPT_APPROVE", id: row.id },
                      reject: { type: "RECEIPT_REJECT", id: row.id },
                    })
                  }
                  onApprove={() => onDecision({ type: "RECEIPT_APPROVE", id: row.id })}
                  onReject={() => onDecision({ type: "RECEIPT_REJECT", id: row.id })}
                />
              ))}
            </div>
          </GroupedSurface>
        </MainSection>
      ) : null}

      <MainSection
        title="Aktivitas terbaru"
        meta={movements.length > 0 ? `${Math.min(movements.length, 5)} terbaru` : undefined}
        action={
          movements.length > 0 ? (
            <SectionAction label="Lihat semua" onClick={() => onNavigate("activity")} />
          ) : undefined
        }
      >
        <GroupedSurface>
          {movements.length === 0 ? (
            <InlineStateRow
              icon="history"
              title="Belum ada pergerakan stok"
              description="Penerimaan, pemakaian, transfer, dan penyesuaian akan muncul di sini."
            />
          ) : (
            <div className="divide-y divide-black/5.5 px-3">
              {movements.slice(0, 5).map((row) => (
                <MovementRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </GroupedSurface>
      </MainSection>

      <ActivityDetailSheet
        target={detailTarget}
        actions={
          presentedDecision
            ? {
                secondary: {
                  label: "Tolak",
                  onClick: () => requestDecisionFromDetail(presentedDecision.reject),
                },
                primary: {
                  label: "Setujui",
                  onClick: () => requestDecisionFromDetail(presentedDecision.approve),
                },
              }
            : undefined
        }
        onClose={() => setDetailTarget(null)}
        onExitComplete={finishDetailExit}
      />
    </div>
  );
}

function StockAvailabilitySplit({ value }: { readonly value: number }): React.JSX.Element {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className="mt-3" aria-label={`Stok siap dipakai ${value.toFixed(1)} persen`}>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/12 ring-1 ring-white/5">
        <span className="h-full bg-white" style={{ width: `${clamped}%` }} aria-hidden="true" />
        <span className="h-full flex-1 bg-white/18" aria-hidden="true" />
      </div>
      <div className="mt-1.5 flex justify-between text-[8px] font-bold tracking-wide text-white/45 uppercase">
        <span>Siap dipakai</span>
        <span>Terikat</span>
      </div>
    </div>
  );
}

function attentionIconClass(tone: MaterialTone): string {
  if (tone === "critical") return "bg-error/8 text-error ring-1 ring-error/6";
  if (tone === "warning") return "bg-warning/9 text-warning ring-1 ring-warning/6";
  if (tone === "pending") return "bg-primary/8 text-primary ring-1 ring-primary/6";
  return "bg-surface-container text-on-surface-variant";
}
