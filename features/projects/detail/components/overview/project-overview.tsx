"use client";

import React, { useState } from "react";

import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import { BottomSheet } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  BudgetSplitIndicator,
  UsageBlockMeter,
} from "@/features/finance-dashboard/components/dashboard-budget-indicators";
import type { DashboardTone } from "@/features/finance-dashboard/lib/dashboard-types";
import { categoryTab, statusTone } from "./project-overview-utils";
export { ProjectIdentityHeader } from "./project-identity-header";

export type ProjectOverviewTab =
  | "rab"
  | "rap"
  | "stok"
  | "expenses"
  | "payments"
  | "profitability";

export type ProjectOverviewAction = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tab: ProjectOverviewTab;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
};

export type ProjectReadinessItem = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tab: ProjectOverviewTab;
  readonly tone: "APPROVED" | "WARNING" | "CRITICAL" | "DRAFT";
};

type ProjectOverviewProps = {
  readonly budget: ProjectBudgetDashboard | null;
  readonly contractValue: number;
  readonly actions: readonly ProjectOverviewAction[];
  readonly readiness: readonly ProjectReadinessItem[];
  readonly onNavigate: (tab: ProjectOverviewTab) => void;
};

function categoryTone(status: string): DashboardTone {
  if (status === "CRITICAL" || status === "OVER_BUDGET") return "critical";
  if (status === "WARNING" || status === "WATCH") return "warning";
  return "positive";
}

function SectionHeading({
  title,
  supporting,
}: {
  readonly title: string;
  readonly supporting?: string;
}): React.JSX.Element {
  return (
    <header className="px-1">
      <h2 className="text-[17px] font-semibold leading-6 text-on-surface">{title}</h2>
      {supporting ? (
        <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">
          {supporting}
        </p>
      ) : null}
    </header>
  );
}

export function ProjectOverview({
  budget,
  contractValue,
  actions,
  readiness,
  onNavigate,
}: ProjectOverviewProps): React.JSX.Element {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const selectedCategory =
    budget?.categories.find((category) => category.id === selectedCategoryId) ?? null;
  const remaining = budget?.remainingBudget ?? 0;
  const used = budget?.usedPercentage ?? 0;
  const margin = budget?.projectedMarginPercentage ?? (contractValue > 0 ? 100 : 0);

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      {!budget ? (
        <section className="rounded-[28px] bg-primary p-5 text-on-primary shadow-[0_16px_38px_rgba(17,17,17,0.14)] max-[430px]:p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
            Posisi proyek
          </p>
          <h2 className="mt-2 text-[20px] font-semibold leading-6">
            Budget internal belum terbentuk
          </h2>
          <p className="mt-2 text-xs leading-5 text-white/65">
            Lengkapi RAP dan RAB agar pengeluaran, stok, pembayaran, dan margin dapat dipantau.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("rap")}
            className="mt-4 min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold text-primary"
          >
            Mulai dari RAP
          </button>
        </section>
      ) : (
        <section className="rounded-[28px] bg-primary p-5 text-on-primary shadow-[0_16px_38px_rgba(17,17,17,0.14)] max-[430px]:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                Sisa budget internal
              </p>
              <MoneyValue
                amount={remaining}
                variant="fullDynamic"
                tone={remaining < 0 ? "danger" : "inverse"}
                size="hero"
                className="mt-1"
              />
            </div>
            <Badge status={remaining < 0 ? "CRITICAL" : used >= 80 ? "WARNING" : "APPROVED"}>
              {remaining < 0 ? "Terlampaui" : used >= 80 ? "Perlu dipantau" : "Terkendali"}
            </Badge>
          </div>

          <BudgetSplitIndicator
            value={used}
            inverse
            danger={remaining < 0}
            tone={remaining < 0 ? "critical" : used >= 80 ? "warning" : "positive"}
          />

          <div className="mt-4 grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 pt-4">
            <FinancialFact label="Nilai proyek" amount={budget.contractValue} />
            <FinancialFact label="Budget" amount={budget.internalBudget} align="center" />
            <FinancialFact label="Realisasi" amount={budget.actualCost} align="right" />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[18px] bg-white/[0.07] px-3 py-2.5">
            <span className="text-[10px] font-semibold text-white/60">Margin proyeksi</span>
            <span className={`financial-amount font-mono text-[13px] font-bold tabular-nums ${margin < 10 ? "text-[#ff9f96]" : "text-white"}`}>
              {margin.toFixed(1)}%
            </span>
          </div>
        </section>
      )}

      <section className="space-y-2.5">
        <SectionHeading title="Kesiapan proyek" supporting="Status dasar sebelum pekerjaan dan transaksi dilanjutkan." />
        <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025]">
          {readiness.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-primary">
                <span className="material-symbols-outlined text-[18px]">
                  {item.tone === "APPROVED" ? "check" : item.tone === "DRAFT" ? "edit_note" : "priority_high"}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-xs font-bold leading-4 text-on-surface">{item.label}</span>
                  <span className="block truncate text-[10px] leading-4 text-on-surface-variant">{item.detail}</span>
                </span>
                <Badge status={item.tone} className="shrink-0">{item.value}</Badge>
              </span>
              <span className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant/55">chevron_right</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionHeading title="Perlu tindakan" supporting={actions.length === 0 ? "Tidak ada hambatan aktif saat ini." : `${actions.length} prioritas teratas berdasarkan dampaknya.`} />
        {actions.length === 0 ? (
          <div className="rounded-[22px] bg-white px-4 py-4 text-xs font-medium text-primary shadow-[0_10px_26px_rgba(17,17,17,0.04)]">
            <span className="material-symbols-outlined mr-2 align-middle text-[18px]">check_circle</span>
            Proyek berjalan tanpa blocker aktif.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025]">
            {actions.slice(0, 3).map((action, index) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onNavigate(action.tab)}
                className={`flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${action.severity === "CRITICAL" ? "bg-error-container/28 text-error" : action.severity === "WARNING" ? "bg-secondary-container/30 text-secondary" : "bg-primary/8 text-primary"}`}>
                  <span className="material-symbols-outlined text-[18px]">{action.severity === "INFO" ? "arrow_forward" : "priority_high"}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold leading-4 text-on-surface">{action.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-on-surface-variant">{action.description}</span>
                </span>
                <Badge status={action.severity === "INFO" ? "DRAFT" : action.severity}>
                  {action.severity === "CRITICAL" ? "Kritis" : action.severity === "WARNING" ? "Perhatian" : "Tinjau"}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </section>

      {budget ? (
        <section className="space-y-2.5">
          <SectionHeading title="Budget per kategori" supporting="Bandingkan realisasi dan sisa pada setiap pos." />
          <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/[0.025]">
            {budget.categories.map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className={`block min-h-[78px] w-full px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-on-surface">{category.name}</span>
                      <Badge status={statusTone(category.status)}>{category.status === "SAFE" ? "Aman" : category.status === "WATCH" ? "Dipantau" : category.status === "OVER_BUDGET" ? "Terlampaui" : category.status}</Badge>
                    </span>
                    <UsageBlockMeter value={category.usedPercentage} tone={categoryTone(category.status)} />
                  </span>
                  <span className="max-w-[42%] shrink-0">
                    <MoneyValue amount={category.remainingAmount} variant="compactWithFull" tone={category.remainingAmount < 0 ? "danger" : "default"} align="right" size="sm" />
                    <span className="mt-1 block text-right font-mono text-[9px] font-bold text-on-surface-variant">{category.usedPercentage.toFixed(1)}%</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <BottomSheet
        open={Boolean(selectedCategory)}
        title={selectedCategory?.name ?? "Detail kategori"}
        onClose={() => setSelectedCategoryId(null)}
        footer={selectedCategory ? (
          <button
            type="button"
            onClick={() => {
              const tab = categoryTab(selectedCategory.code);
              setSelectedCategoryId(null);
              onNavigate(tab);
            }}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary"
          >
            {selectedCategory.code === "OPERASIONAL" || selectedCategory.code === "LAIN_LAIN" ? "Buka pengeluaran" : "Buka rencana internal"}
          </button>
        ) : undefined}
      >
        {selectedCategory ? (
          <div className="overflow-hidden rounded-[22px] bg-surface-container-low">
            <DetailMoneyRow label="Budget" amount={selectedCategory.allocatedAmount} />
            <DetailMoneyRow label="Realisasi" amount={selectedCategory.actualAmount} />
            <DetailMoneyRow label="Menunggu" amount={selectedCategory.pendingAmount} />
            <DetailMoneyRow label="Terbayar" amount={selectedCategory.paidAmount} />
            <DetailMoneyRow label="Sisa" amount={selectedCategory.remainingAmount} danger={selectedCategory.remainingAmount < 0} />
            <div className="border-t border-outline-variant/25 px-4 py-3">
              <div className="flex justify-between text-xs font-bold"><span>Budget terpakai</span><span>{selectedCategory.usedPercentage.toFixed(1)}%</span></div>
              <UsageBlockMeter value={selectedCategory.usedPercentage} tone={categoryTone(selectedCategory.status)} />
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function FinancialFact({ label, amount, align = "left" }: { readonly label: string; readonly amount: number; readonly align?: "left" | "center" | "right" }): React.JSX.Element {
  const alignClass = align === "center" ? "px-2 text-center" : align === "right" ? "pl-2 text-right" : "pr-2 text-left";
  return (
    <div className={`min-w-0 ${alignClass}`}>
      <p className="truncate text-[8px] font-bold uppercase tracking-wide text-white/50">{label}</p>
      <MoneyValue amount={amount} variant="compactWithFull" tone="inverse" align={align === "right" ? "right" : "left"} size="xs" className={align === "center" ? "text-center" : ""} />
    </div>
  );
}

function DetailMoneyRow({ label, amount, danger = false }: { readonly label: string; readonly amount: number; readonly danger?: boolean }): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-outline-variant/25 px-4 py-3 first:border-t-0">
      <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
      <MoneyValue amount={amount} variant="compactWithFull" tone={danger ? "danger" : "default"} align="right" size="sm" />
    </div>
  );
}
