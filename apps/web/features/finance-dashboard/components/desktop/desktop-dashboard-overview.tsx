"use client";
import { DashboardCashFlowSkeleton } from "./dashboard-desktop-skeletons";
import React from "react";
import {
  Button,
  ButtonLink,
  CashFlowTrendChart,
  ContextPopover,
  DesktopTable,
  FilterSelect,
  GroupedSurface,
  InlineStateRow,
  MoneyValue,
} from "@/components/ui";
import type { FinanceDashboardOverview } from "@atria/core/finance/dashboard-contracts";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import { useDashboardCashFlow } from "../../hooks/use-desktop-dashboard-data";
import { DASHBOARD_PROJECT_COLUMNS, DesktopCategoryPanel } from "./desktop-dashboard-tabs";
import Link from "@/lib/navigation/workspace-link";

export function DesktopBudgetBand({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  const summary = data.summary,
    paid = data.categories.reduce((total, row) => total + row.paidAmount, 0),
    hasBudget = data.categories.length > 0 || summary.projectValue > 0;
  const metrics = [
    { label: "Nilai proyek", amount: summary.projectValue, detail: "Proyek aktif berbudget" },
    {
      label: "Budget internal",
      amount: summary.internalBudget,
      detail: `Margin proyeksi ${summary.projectedMarginPercentage.toFixed(1)}%`,
    },
    {
      label: "Terpakai",
      amount: summary.actualCost,
      detail: `${summary.usedPercentage.toFixed(1)}% dari budget`,
    },
    {
      label: "Sisa budget",
      amount: summary.remainingBudget,
      detail: "Budget setelah biaya tercatat",
    },
  ];
  return (
    <GroupedSurface variant="desktopPanel">
      <dl className="grid grid-cols-4 divide-x divide-outline-variant/20">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 p-4">
            <dt className="mb-2 text-support text-on-surface-variant">{metric.label}</dt>
            <dd>
              {hasBudget ? (
                <MoneyValue
                  amount={metric.amount}
                  variant="compact"
                  size="lg"
                  tone={metric.amount < 0 ? "danger" : "default"}
                />
              ) : (
                <span className="text-title text-on-surface-variant">—</span>
              )}
            </dd>
            <p className="mt-2 text-meta text-on-surface-variant">
              {hasBudget ? metric.detail : "Belum ada budget aktif"}
            </p>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-outline-variant/20 px-4 py-2.5 text-support text-on-surface-variant">
        {hasBudget ? (
          <>
            <span>
              Sudah dibayar <MoneyValue amount={paid} size="sm" variant="compact" />
            </span>
            <span>
              Proyeksi margin{" "}
              <MoneyValue
                amount={summary.projectedMarginAmount}
                size="sm"
                variant="compact"
                tone={summary.projectedMarginAmount < 0 ? "danger" : "default"}
              />
            </span>
            <span>Posisi budget proyek aktif saat ini</span>
          </>
        ) : (
          <span>Posisi budget tersedia setelah proyek aktif memiliki budget.</span>
        )}
      </div>
    </GroupedSurface>
  );
}
export function DesktopDashboardOverview({
  data,
  setup,
}: {
  readonly data: FinanceDashboardOverview;
  readonly setup: OrganizationSetupOverview | null;
}): React.JSX.Element {
  const trend = useDashboardCashFlow(data.generatedAt);
  const excluded = trend.data
    ? Object.values(trend.data.exclusions).reduce((total, row) => total + row.count, 0)
    : 0;
  return (
    <div className="space-y-4">
      <DesktopBudgetBand data={data} />
      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] items-start gap-4">
        <GroupedSurface variant="desktopPanel" className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-section font-semibold">Arus kas bulanan</h2>
              <p className="mt-1 text-support text-on-surface-variant">
                Kas masuk dan keluar yang tercatat
              </p>
            </div>
            <FilterSelect
              label="Rentang grafik"
              value={String(trend.months)}
              searchable={false}
              options={[
                { value: "6", label: "6 bulan" },
                { value: "12", label: "12 bulan" },
              ]}
              onChange={trend.change}
            />
          </div>
          {trend.error ? (
            <InlineStateRow
              icon="warning"
              title="Tren kas belum tersedia"
              description={trend.error}
              action={
                <Button size="compact" onClick={trend.reload}>
                  Coba lagi
                </Button>
              }
            />
          ) : trend.loading ? (
            <DashboardCashFlowSkeleton months={trend.months} />
          ) : trend.data?.transactionCount ? (
            <CashFlowTrendChart buckets={trend.data.buckets} />
          ) : (
            <div className="flex min-h-52 items-center">
              <InlineStateRow
                icon="monitoring"
                title="Belum ada arus kas pada periode ini"
                description="Grafik muncul setelah kas masuk atau keluar dicatat."
              />
            </div>
          )}
          {!trend.loading && trend.data ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/20 pt-3 text-meta text-on-surface-variant">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span>Arus bersih</span>
                  <MoneyValue amount={trend.data.totalNet} variant="compact" size="sm" />
                </div>
                <span>
                  {excluded > 0
                    ? `${excluded} catatan di luar arus kas`
                    : "Tanpa saldo awal dan transfer internal"}
                </span>
              </div>
              {excluded > 0 ? (
                <ContextPopover
                  label="Pengecualian arus kas"
                  placement="top-start"
                  width={360}
                  trigger={
                    <Button size="mini" variant="tertiary">
                      Rincian pengecualian
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    <h3 className="text-section font-semibold">Catatan di luar arus kas</h3>
                    {(
                      [
                        { key: "opening", label: "Saldo awal" },
                        { key: "transfer", label: "Transfer antar-rekening" },
                        { key: "adjustment", label: "Koreksi / penyesuaian" },
                        { key: "unclassified", label: "Belum terklasifikasi" },
                      ] as const
                    ).map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 text-support"
                      >
                        <span>
                          {item.label} · {trend.data?.exclusions[item.key].count}
                        </span>
                        <MoneyValue
                          amount={trend.data?.exclusions[item.key].amount ?? 0}
                          variant="compact"
                          size="sm"
                        />
                      </div>
                    ))}
                    <p className="text-meta text-on-surface-variant">
                      Transfer mencakup kedua sisi rekening. Catatan ini tetap memengaruhi saldo
                      sesuai ledger.
                    </p>
                  </div>
                </ContextPopover>
              ) : null}
            </div>
          ) : null}
        </GroupedSurface>
        <DesktopCategoryPanel data={data} />
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-section font-semibold">Proyek prioritas</h2>
          <ButtonLink href="/ledger?tab=budget" size="compact" variant="secondary">
            Lihat budget
          </ButtonLink>
        </div>
        <DesktopTable
          ariaLabel="Proyek prioritas"
          columns={DASHBOARD_PROJECT_COLUMNS}
          rows={data.riskyProjects.slice(0, 5)}
          rowKey={(row) => row.projectId}
          rowHref={(row) => `/projects/${row.projectId}?tab=overview`}
          emptyTitle={
            data.categories.length === 0
              ? "Belum ada budget proyek aktif"
              : "Tidak ada proyek yang memerlukan perhatian"
          }
          emptyDescription="Posisi budget dan margin mengikuti data proyek aktif."
        />
      </section>
      {setup && (!setup.allRequiredReady || setup.quickStart.state.status !== "COMPLETED") ? (
        <GroupedSurface variant="desktopPanel">
          <InlineStateRow
            icon="task_alt"
            title="Kesiapan operasional"
            description={`${setup.requiredReadyCount} dari ${setup.requiredTotal} fondasi wajib siap.`}
            action={
              <ButtonLink
                size="compact"
                href={
                  setup.canManageQuickStart && setup.quickStart.state.status !== "COMPLETED"
                    ? "/onboarding"
                    : "/settings?tab=readiness"
                }
              >
                Lihat checklist
              </ButtonLink>
            }
          />
        </GroupedSurface>
      ) : null}
      <GroupedSurface variant="desktopPanel" className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section font-semibold">Posisi kas & tindak lanjut</h2>
          <div className="flex flex-wrap gap-4 text-support">
            <span>
              Kas <MoneyValue amount={data.summary.cashAvailable} size="sm" variant="compact" />
            </span>
            <span>
              Piutang{" "}
              <MoneyValue
                amount={data.summary.receivablesOutstanding}
                size="sm"
                variant="compact"
              />
            </span>
            <span>
              Hutang{" "}
              <MoneyValue amount={data.summary.payablesOutstanding} size="sm" variant="compact" />
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div>
            <h3 className="text-row font-semibold">Perlu keputusan</h3>
            <div className="mt-2 space-y-2">
              {data.actions.length ? (
                data.actions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="block rounded-icon text-support outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <p>{action.title}</p>
                    <p className="text-meta text-on-surface-variant">{action.description}</p>
                  </Link>
                ))
              ) : (
                <p className="text-support text-on-surface-variant">
                  Belum ada prioritas tertunda.
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-row font-semibold">Jatuh tempo terdekat</h3>
            <div className="mt-2 space-y-2">
              {data.dashboardDetails.cashDue.length ? (
                data.dashboardDetails.cashDue.slice(0, 3).map((row) => (
                  <Link
                    key={`${row.type}-${row.id}`}
                    href={row.href}
                    className="block rounded-icon text-support outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <p>{row.counterpartyName}</p>
                    <MoneyValue amount={row.outstandingAmount} size="sm" variant="compact" />
                  </Link>
                ))
              ) : (
                <p className="text-support text-on-surface-variant">Belum ada dokumen terbuka.</p>
              )}
            </div>
            <ButtonLink href="/ledger?tab=cash" size="mini" variant="tertiary" className="mt-3">
              Lihat jatuh tempo
            </ButtonLink>
          </div>
          <div>
            <h3 className="text-row font-semibold">Perhatian material</h3>
            <div className="mt-2 space-y-2">
              {data.dataQuality.unavailableSources.some((source) =>
                [
                  "inventori",
                  "kebutuhan RAP",
                  "penerimaan material",
                  "pergerakan material",
                ].includes(source),
              ) ? (
                <p className="text-support text-critical">Data material belum lengkap.</p>
              ) : data.dashboardDetails.materials.length ? (
                data.dashboardDetails.materials.slice(0, 3).map((row) => (
                  <Link
                    key={row.id}
                    href={row.href}
                    className="block rounded-icon text-support outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    {row.materialName}
                    <p className="text-meta text-on-surface-variant">{row.description}</p>
                  </Link>
                ))
              ) : (
                <p className="text-support text-on-surface-variant">
                  Belum ada perhatian material.
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-row font-semibold">Aktivitas kas</h3>
            <div className="mt-2 space-y-2">
              {data.recentTransactions.length ? (
                data.recentTransactions.slice(0, 3).map((row) => (
                  <Link
                    key={row.id}
                    href={`/ledger?tab=accounts&account=${row.bankAccountId}`}
                    className="block rounded-icon text-support outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <p>{row.description}</p>
                    <MoneyValue amount={row.amount} size="sm" variant="compact" />
                  </Link>
                ))
              ) : (
                <p className="text-support text-on-surface-variant">Belum ada transaksi kas.</p>
              )}
            </div>
          </div>
        </div>
      </GroupedSurface>
    </div>
  );
}
