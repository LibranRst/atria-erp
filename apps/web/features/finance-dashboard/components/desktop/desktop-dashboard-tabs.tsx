"use client";
import React from "react";
import {
  AppIcon,
  ButtonLink,
  DesktopTable,
  GroupedSurface,
  InlineStateRow,
  MoneyValue,
  StatusBadge,
  type DesktopTableColumn,
} from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import type {
  FinanceDashboardRiskyProject,
  FinanceDashboardCategory,
} from "@atria/core/finance/dashboard-overview";
import type {
  FinanceDashboardOverview,
  FinanceDashboardCashDueItem,
  FinanceDashboardMaterialIssue,
} from "@atria/core/finance/dashboard-contracts";
import type { DesktopDashboardQuery } from "../../hooks/use-desktop-dashboard-data";
import { DashboardDesktopTable } from "./desktop-dashboard-table";

const money = (amount: number): React.JSX.Element => (
  <MoneyValue
    amount={amount}
    variant="compact"
    size="sm"
    tone={amount < 0 ? "danger" : "default"}
  />
);
const status = (value: string): React.JSX.Element => (
  <StatusBadge
    label={formatBusinessLabel(value)}
    tone={
      value === "CRITICAL" || value === "OVER_BUDGET"
        ? "critical"
        : value === "WARNING" || value === "WATCH"
          ? "warning"
          : "neutral"
    }
  />
);
export const DASHBOARD_PROJECT_COLUMNS: readonly DesktopTableColumn<FinanceDashboardRiskyProject>[] =
  [
    {
      key: "name",
      label: "Proyek",
      sortable: true,
      render: (row) => (
        <div className="min-w-36">
          <p className="text-row font-semibold">{row.projectName}</p>
          <p className="mt-0.5 max-w-60 text-meta text-on-surface-variant">
            {row.effectiveHealth === "HEALTHY" ? "Budget dan margin dalam batas" : row.riskReason}
          </p>
        </div>
      ),
    },
    { key: "budget", label: "Budget", align: "end", render: (row) => money(row.internalBudget) },
    {
      key: "amount",
      label: "Terpakai",
      sortable: true,
      align: "end",
      render: (row) => money(row.actualCost),
    },
    {
      key: "remaining",
      label: "Sisa",
      sortable: true,
      align: "end",
      render: (row) => money(row.remainingBudget),
    },
    {
      key: "margin",
      label: "Margin",
      sortable: true,
      align: "end",
      render: (row) => (
        <span
          className={`text-support font-semibold tabular-nums ${row.projectedMarginPercentage < row.targetMarginPercentage ? "text-critical" : ""}`}
        >
          {row.projectedMarginPercentage.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "priority",
      label: "Kondisi",
      sortable: true,
      render: (row) => status(row.effectiveHealth),
    },
  ];
const CATEGORY_COLUMNS: readonly DesktopTableColumn<FinanceDashboardCategory>[] = [
  {
    key: "name",
    label: "Kategori",
    render: (row) => <span className="font-semibold">{row.name}</span>,
  },
  { key: "allocated", label: "Alokasi", align: "end", render: (row) => money(row.allocatedAmount) },
  { key: "pending", label: "Menunggu", align: "end", render: (row) => money(row.pendingAmount) },
  { key: "used", label: "Terpakai", align: "end", render: (row) => money(row.actualAmount) },
  { key: "paid", label: "Dibayar", align: "end", render: (row) => money(row.paidAmount) },
  { key: "remaining", label: "Sisa", align: "end", render: (row) => money(row.remainingAmount) },
  {
    key: "status",
    label: "Penggunaan",
    render: (row) => (
      <div className="flex items-center gap-2">
        <span className="tabular-nums">{row.usedPercentage.toFixed(0)}%</span>
        {status(row.status)}
      </div>
    ),
  },
];
export function DesktopBudgetTab({
  data,
  query,
}: {
  readonly data: FinanceDashboardOverview;
  readonly query: DesktopDashboardQuery;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <DashboardDesktopTable
        title="Budget proyek aktif"
        query={query}
        rows={query.data?.tab === "budget" ? query.data.rows : []}
        columns={DASHBOARD_PROJECT_COLUMNS}
        rowKey={(row) => row.projectId}
        rowHref={(row) => `/projects/${row.projectId}?tab=overview`}
        filters={[
          { value: "all", label: "Semua kondisi" },
          { value: "CRITICAL", label: "Kritis" },
          { value: "WARNING", label: "Perhatian" },
          { value: "HEALTHY", label: "Terkendali" },
        ]}
      />
      <div className="space-y-3">
        <h2 className="text-section font-semibold">Penggunaan kategori</h2>
        <DesktopTable
          ariaLabel="Penggunaan budget per kategori"
          columns={CATEGORY_COLUMNS}
          rows={data.categories}
          rowKey={(row) => row.code}
          emptyTitle="Belum ada budget kategori aktif"
        />
      </div>
    </div>
  );
}

export function DesktopApprovalsTable({
  query,
  onOpen,
}: {
  readonly query: DesktopDashboardQuery;
  readonly onOpen: (item: ApprovalDetail) => void;
}): React.JSX.Element {
  const columns: readonly DesktopTableColumn<ApprovalDetail>[] = [
    {
      key: "name",
      label: "Pengajuan",
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-semibold">{r.projectName}</p>
          <p className="max-w-72 text-support text-on-surface-variant">{r.description}</p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Jenis",
      render: (r) =>
        r.type === "project_cost"
          ? "Biaya lapangan"
          : r.type === "vendor_payment"
            ? "Pembayaran vendor"
            : "Saldo awal stok",
    },
    { key: "requester", label: "Pemohon", render: (r) => r.requestedBy },
    {
      key: "amount",
      label: "Nominal",
      sortable: true,
      align: "end",
      render: (r) => money(r.amount),
    },
    {
      key: "date",
      label: "Diajukan",
      sortable: true,
      render: (r) =>
        new Date(r.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Jakarta",
        }),
    },
    {
      key: "priority",
      label: "Prioritas",
      sortable: true,
      render: (r) => (
        <div>
          {status(r.priority)}
          <p className="mt-1 max-w-56 text-meta text-on-surface-variant">{r.priorityReason}</p>
        </div>
      ),
    },
  ];
  return (
    <DashboardDesktopTable
      title="Antrean persetujuan"
      query={query}
      rows={query.data?.tab === "approvals" ? query.data.rows : []}
      columns={columns}
      rowKey={(r) => r.id}
      onRowAction={onOpen}
      filters={[
        { value: "all", label: "Semua pengajuan" },
        { value: "project_cost", label: "Biaya lapangan" },
        { value: "vendor_payment", label: "Pembayaran vendor" },
        { value: "inventory_opening", label: "Saldo awal stok" },
      ]}
    />
  );
}
export function DesktopCashDueTab({
  query,
  data,
}: {
  readonly data: FinanceDashboardOverview;
  readonly query: DesktopDashboardQuery;
}): React.JSX.Element {
  const columns: readonly DesktopTableColumn<FinanceDashboardCashDueItem>[] = [
    {
      key: "date",
      label: "Jatuh tempo",
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-semibold">
            {new Date(r.dueDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Jakarta",
            })}
          </p>
          <p
            className={
              r.dayOffset < 0 ? "text-meta text-critical" : "text-meta text-on-surface-variant"
            }
          >
            {r.dayOffset < 0
              ? `${-r.dayOffset} hari terlambat`
              : r.dayOffset === 0
                ? "Hari ini"
                : `${r.dayOffset} hari lagi`}
          </p>
        </div>
      ),
    },
    {
      key: "name",
      label: "Dokumen / pihak",
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-semibold">{r.documentNumber}</p>
          <p className="text-support text-on-surface-variant">
            {r.counterpartyName} · {r.projectName}
          </p>
        </div>
      ),
    },
    { key: "type", label: "Jenis", render: (r) => (r.type === "payable" ? "Hutang" : "Piutang") },
    { key: "total", label: "Total", align: "end", render: (r) => money(r.amount) },
    { key: "paid", label: "Dibayar", align: "end", render: (r) => money(r.paidAmount) },
    {
      key: "amount",
      label: "Sisa",
      align: "end",
      sortable: true,
      render: (r) => money(r.outstandingAmount),
    },
    { key: "status", label: "Status", render: (r) => formatBusinessLabel(r.status) },
  ];
  return (
    <div className="space-y-4">
      <GroupedSurface
        variant="desktopPanel"
        className="grid grid-cols-3 divide-x divide-outline-variant/20 p-4"
      >
        {[
          { label: "Hutang terbuka", amount: data.summary.payablesOutstanding },
          { label: "Piutang terbuka", amount: data.summary.receivablesOutstanding },
          { label: "Pembayaran ≤7 hari", amount: data.summary.payablesDueSoon },
        ].map((item, index) => (
          <div key={item.label} className={index ? "px-4" : "pr-4"}>
            <p className="mb-1 text-support text-on-surface-variant">{item.label}</p>
            {money(item.amount)}
          </div>
        ))}
      </GroupedSurface>
      <DashboardDesktopTable
        title="Dokumen jatuh tempo"
        query={query}
        rows={query.data?.tab === "cash" ? query.data.rows : []}
        columns={columns}
        rowKey={(r) => `${r.type}-${r.id}`}
        rowHref={(r) => r.href}
        filters={[
          { value: "all", label: "Hutang & piutang" },
          { value: "payable", label: "Hutang" },
          { value: "receivable", label: "Piutang" },
        ]}
      />
    </div>
  );
}
export function DesktopMaterialsTab({
  data,
  query,
}: {
  readonly data: FinanceDashboardOverview;
  readonly query: DesktopDashboardQuery;
}): React.JSX.Element {
  const columns: readonly DesktopTableColumn<FinanceDashboardMaterialIssue>[] = [
    {
      key: "name",
      label: "Material / dokumen",
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-semibold">{r.materialName}</p>
          <p className="text-support text-on-surface-variant">
            {r.projectName ?? r.locationName ?? "Gudang"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Perhatian",
      render: (r) =>
        ({
          RAP_SHORTAGE: "Kebutuhan RAP",
          LOW_STOCK: "Stok minimum",
          REVERSAL_REQUEST: "Permintaan reversal",
          WASTE: "Waste",
          ADJUSTMENT: "Penyesuaian",
        })[r.type],
    },
    {
      key: "available",
      label: "Tersedia",
      align: "end",
      render: (r) =>
        r.type === "RAP_SHORTAGE" || r.type === "LOW_STOCK" ? `${r.availableStock} ${r.unit}` : "—",
    },
    {
      key: "amount",
      label: "Kebutuhan / jumlah",
      sortable: true,
      align: "end",
      render: (r) =>
        `${(r.type === "RAP_SHORTAGE" ? r.requiredStock : r.type === "LOW_STOCK" ? r.minimumStock : r.quantity) ?? "—"} ${r.unit}`,
    },
    { key: "priority", label: "Kondisi", sortable: true, render: (r) => status(r.severity) },
    {
      key: "date",
      label: "Tanggal",
      sortable: true,
      render: (r) =>
        r.createdAt
          ? new Date(r.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              timeZone: "Asia/Jakarta",
            })
          : "—",
    },
  ];
  return (
    <div className="space-y-4">
      <GroupedSurface
        variant="desktopPanel"
        className="grid grid-cols-3 divide-x divide-outline-variant/20 p-4"
      >
        <div>
          <p className="text-support text-on-surface-variant">Nilai stok</p>
          {money(data.stockIssues.totalStockValue)}
        </div>
        <div className="px-4">
          <p className="text-support text-on-surface-variant">Stok belum direservasi</p>
          {money(data.stockIssues.reusableStockValue)}
        </div>
        <div className="pl-4">
          <p className="text-support text-on-surface-variant">Kebutuhan RAP / stok rendah</p>
          <p className="font-semibold">
            {data.stockIssues.materialShortageCount} / {data.stockIssues.lowStockCount}
          </p>
        </div>
      </GroupedSurface>
      <DashboardDesktopTable
        title="Perhatian material"
        query={query}
        rows={query.data?.tab === "materials" ? query.data.rows : []}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => r.href}
        filters={[
          { value: "all", label: "Semua perhatian" },
          { value: "RAP_SHORTAGE", label: "Kebutuhan RAP" },
          { value: "LOW_STOCK", label: "Stok minimum" },
          { value: "REVERSAL_REQUEST", label: "Permintaan reversal" },
          { value: "WASTE", label: "Waste" },
          { value: "ADJUSTMENT", label: "Penyesuaian" },
        ]}
      />
    </div>
  );
}

export function DesktopCategoryPanel({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-section font-semibold">Kontrol kategori</h2>
        <ButtonLink href="/ledger?tab=budget" size="mini" variant="tertiary">
          Rincian
        </ButtonLink>
      </div>
      {data.categories.length === 0 ? (
        <InlineStateRow
          icon="monitoring"
          title="Belum ada budget aktif"
          description="Kategori muncul setelah budget proyek disiapkan."
        />
      ) : (
        <div className="divide-y divide-outline-variant/20">
          {data.categories.map((row) => (
            <div key={row.code} className="flex items-center justify-between gap-3 py-1.5">
              <div>
                <p className="text-row font-semibold">{row.name}</p>
                <p className="flex items-center gap-1 text-meta text-on-surface-variant">
                  {row.usedPercentage.toFixed(0)}% terpakai
                  <AppIcon
                    name={row.status === "SAFE" ? "check_circle" : "warning"}
                    className={`icon-xs ${row.status === "SAFE" ? "" : "text-critical"}`}
                  />
                  <span>
                    {row.status === "SAFE"
                      ? "Aman"
                      : row.status === "WATCH"
                        ? "Perhatian"
                        : row.status === "OVER_BUDGET"
                          ? "Melebihi budget"
                          : "Kritis"}
                  </span>
                </p>
              </div>
              <div className="text-end">
                {money(row.remainingAmount)}
                <span className="block text-meta text-on-surface-variant">sisa budget</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.categories.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 border-t border-outline-variant/20 pt-3 text-support">
          <AppIcon name="monitoring" className="icon-sm" />
          <span>Proyeksi margin {data.summary.projectedMarginPercentage.toFixed(1)}%</span>
          {data.summary.projectedMarginPercentage < 0 ? (
            <StatusBadge tone="critical" label="Perlu tindakan" />
          ) : null}
        </div>
      ) : null}
    </GroupedSurface>
  );
}
