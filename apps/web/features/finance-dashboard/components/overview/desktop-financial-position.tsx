"use client";

import React from "react";
import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { MoneyValue, SummarySurface, SummaryFact, StatusBadge } from "@/components/ui";
import { PilotBalanceNotice } from "../shared/pilot-balance-notice";

export function DesktopFinancialPosition({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  const { summary } = data;
  const paidAmount = data.categories.reduce((sum, category) => sum + category.paidAmount, 0);
  const risk = summary.remainingBudget < 0 || summary.projectedMarginPercentage < 0;
  return (
    <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
      <section
        aria-label="Posisi budget proyek aktif"
        className="rounded-owner bg-surface-inverse p-5 text-on-primary shadow-inverse"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-title font-semibold">Sisa budget proyek aktif</h2>
            <MoneyValue
              amount={summary.remainingBudget}
              variant="fullDynamic"
              size="hero"
              tone={summary.remainingBudget < 0 ? "danger" : "inverse"}
              className="mt-2"
            />
          </div>
          <StatusBadge
            tone={risk ? "critical" : "healthy"}
            label={risk ? "Perlu tindakan" : "Terkendali"}
          />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-x-5 gap-y-4 border-t border-white/12 pt-4">
          {[
            { label: "Nilai proyek", value: summary.projectValue },
            { label: "Budget internal", value: summary.internalBudget },
            { label: "Budget terpakai", value: summary.actualCost },
            { label: "Sudah dibayar", value: paidAmount },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-meta text-white/70">{item.label}</dt>
              <dd className="mt-1">
                <MoneyValue amount={item.value} variant="compact" size="md" tone="inverse" />
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-meta text-white/70">Penggunaan budget</dt>
            <dd className="mt-1 text-title font-bold tabular-nums">
              {summary.usedPercentage.toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-meta text-white/70">Margin proyeksi</dt>
            <dd
              className={`mt-1 text-title font-bold tabular-nums ${summary.projectedMarginPercentage < 0 ? "text-critical-on-inverse" : ""}`}
            >
              {summary.projectedMarginPercentage.toFixed(1)}%
            </dd>
          </div>
        </dl>
      </section>
      <SummarySurface
        ariaLabel="Posisi kas perusahaan"
        eyebrow="Posisi kas"
        icon="account_balance"
        status={summary.payablesDueSoon > summary.cashAvailable ? "Periksa kas" : "Terkendali"}
        statusTone={summary.payablesDueSoon > summary.cashAvailable ? "warning" : "positive"}
      >
        {process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE === "true" ? (
          <div className="px-4 pt-3">
            <PilotBalanceNotice />
          </div>
        ) : null}
        <div className="p-4">
          <p className="text-support text-on-surface-variant">Kas tersedia</p>
          <MoneyValue
            amount={summary.cashAvailable}
            variant="fullDynamic"
            size="lg"
            className="mt-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <SummaryFact label="Piutang" amount={summary.receivablesOutstanding} />
          <SummaryFact label="Utang" amount={summary.payablesOutstanding} />
        </div>
        <div className="px-4 pt-2 pb-4">
          <p className="text-meta text-on-surface-variant">Pembayaran jatuh tempo ≤ 7 hari</p>
          <MoneyValue
            amount={summary.payablesDueSoon}
            variant="compact"
            size="md"
            tone={summary.payablesDueSoon > summary.cashAvailable ? "danger" : "default"}
            className="mt-1"
          />
        </div>
      </SummarySurface>
    </div>
  );
}
