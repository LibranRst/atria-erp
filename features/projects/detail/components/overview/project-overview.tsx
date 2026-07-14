"use client";

import React, { useState } from "react";

import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import { BottomSheet } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { MetricGrid, MoneyValue, NativeSection } from "@/components/ui/page-primitives";
import {
  DetailMetric,
  SummaryMetric,
} from "./project-overview-primitives";
import {
  categoryTab,
  statusTone,
} from "./project-overview-utils";
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

export function ProjectOverview({
  budget,
  contractValue,
  actions,
  readiness,
  onNavigate,
}: ProjectOverviewProps): React.JSX.Element {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const selectedCategory =
    budget?.categories.find((category) => category.id === selectedCategoryId) ??
    null;
  const remaining = budget?.remainingBudget ?? 0;
  const used = budget?.usedPercentage ?? 0;
  const margin =
    budget?.projectedMarginPercentage ?? (contractValue > 0 ? 100 : 0);

  return (
    <div className="space-y-md">
      {!budget ? (
        <section className="rounded-[28px] bg-primary p-md text-on-primary shadow-[0_16px_38px_rgba(17,17,17,0.14)]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
            Setup diperlukan
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            Budget proyek belum tersedia.
          </h2>
          <p className="mt-1 text-xs text-white/65">
            Selesaikan RAP dan RAB untuk membentuk baseline finansial.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("rap")}
            className="mt-4 min-h-11 w-full rounded-full bg-white px-4 text-xs font-bold text-primary"
          >
            Buka RAP
          </button>
        </section>
      ) : (
        <section className="rounded-[28px] bg-primary p-md text-on-primary shadow-[0_16px_38px_rgba(17,17,17,0.14)]">
          <div className="flex flex-col items-start gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/55">
                Sisa internal budget
              </p>
              <MoneyValue
                amount={remaining}
                variant="fullDynamic"
                tone={remaining < 0 ? "danger" : "inverse"}
                size="hero"
                className="mt-1"
              />
            </div>
            <Badge
              className="self-start"
              status={
                remaining < 0 ? "CRITICAL" : used >= 75 ? "WARNING" : "APPROVED"
              }
            >
              {used.toFixed(1)}% terpakai
            </Badge>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full ${remaining < 0 ? "bg-error" : "bg-white"}`}
              style={{ width: `${Math.min(Math.max(used, 0), 100)}%` }}
            />
          </div>
          <MetricGrid className="mt-md">
            <SummaryMetric label="Nilai proyek" value={budget.contractValue} />
            <SummaryMetric
              label="Internal budget"
              value={budget.internalBudget}
            />
            <SummaryMetric label="Realisasi" value={budget.actualCost} />
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">
                Projected margin
              </p>
              <p className={`financial-amount mt-1 font-mono text-[13px] font-bold leading-4 ${margin < 10 ? "text-error" : "text-white"}`}>
                {margin.toFixed(1)}%
              </p>
            </div>
          </MetricGrid>
        </section>
      )}

      <NativeSection eyebrow="Readiness" title="Kesiapan proyek">
        <div className="grid grid-cols-2 items-start gap-2">
          {readiness.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="min-w-0 rounded-2xl bg-surface-container-low px-3 py-2.5 text-left transition active:scale-[0.98]"
            >
              <div className="flex min-w-0 items-center justify-between gap-1.5">
                <p className="min-w-0 flex-1 truncate text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                  {item.label}
                </p>
                <Badge
                  status={item.tone}
                  className="min-h-4 max-w-[58%] shrink truncate px-2 py-0 text-[8px] leading-4 tracking-normal"
                >
                  {item.value}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-on-surface-variant">
                {item.detail}
              </p>
            </button>
          ))}
        </div>
      </NativeSection>

      <NativeSection eyebrow="Actions" title="Perlu tindakan">
        {actions.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low px-4 py-4 text-xs font-medium text-primary">
            Proyek berjalan tanpa blocker aktif.
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/35 overflow-hidden rounded-2xl bg-surface-container-low">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onNavigate(action.tab)}
                className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition active:scale-[0.99]"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${action.severity === "CRITICAL" ? "bg-error-container/25 text-error" : action.severity === "WARNING" ? "bg-secondary-container/20 text-secondary" : "bg-primary/8 text-primary"}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {action.severity === "CRITICAL"
                      ? "priority_high"
                      : "arrow_forward"}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-on-surface-variant">
                    {action.description}
                  </span>
                </span>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        )}
      </NativeSection>

      {budget && (
        <NativeSection eyebrow="Budget" title="Budget per kategori">
          <div className="divide-y divide-outline-variant/35 overflow-hidden rounded-2xl bg-surface-container-low">
            {budget.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className="block w-full px-3 py-3 text-left transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-bold">
                      {category.name}
                    </p>
                    <Badge status={statusTone(category.status)}>
                      {category.status === "SAFE" ? "Aman" : category.status}
                    </Badge>
                  </div>
                  <div className="max-w-[45%] shrink-0 text-right">
                    <MoneyValue
                      amount={category.remainingAmount}
                      variant="compactWithFull"
                      tone={category.remainingAmount < 0 ? "danger" : "default"}
                      align="right"
                      size="sm"
                    />
                    <p className="text-[9px] text-on-surface-variant">
                      {category.usedPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full ${category.status === "OVER_BUDGET" || category.status === "CRITICAL" ? "bg-error" : category.status === "WATCH" ? "bg-secondary" : "bg-primary"}`}
                    style={{
                      width: `${Math.min(category.usedPercentage, 100)}%`,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </NativeSection>
      )}

      <BottomSheet
        open={Boolean(selectedCategory)}
        title={selectedCategory?.name ?? "Detail Kategori"}
        onClose={() => setSelectedCategoryId(null)}
        footer={
          selectedCategory ? (
            <button
              type="button"
              onClick={() => {
                const tab = categoryTab(selectedCategory.code);
                setSelectedCategoryId(null);
                onNavigate(tab);
              }}
              className="min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary"
            >
              {selectedCategory.code === "OPERASIONAL" ||
              selectedCategory.code === "LAIN_LAIN"
                ? "Buka Expenses"
                : "Buka Internal Plan"}
            </button>
          ) : undefined
        }
      >
        {selectedCategory && (
          <div className="space-y-sm">
            <MetricGrid>
              <DetailMetric
                label="Budget"
                value={selectedCategory.allocatedAmount}
              />
              <DetailMetric
                label="Actual"
                value={selectedCategory.actualAmount}
              />
              <DetailMetric
                label="Pending"
                value={selectedCategory.pendingAmount}
              />
              <DetailMetric label="Paid" value={selectedCategory.paidAmount} />
              <DetailMetric
                label="Remaining"
                value={selectedCategory.remainingAmount}
                danger={selectedCategory.remainingAmount < 0}
              />
            </MetricGrid>
            <div className="rounded-2xl bg-surface-container-low p-3">
              <div className="flex justify-between text-xs font-bold">
                <span>Budget terpakai</span>
                <span>{selectedCategory.usedPercentage.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full ${selectedCategory.remainingAmount < 0 ? "bg-error" : "bg-primary"}`}
                  style={{
                    width: `${Math.min(selectedCategory.usedPercentage, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
