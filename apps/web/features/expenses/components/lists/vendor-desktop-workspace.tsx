"use client";

import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import React from "react";
import {
  AppIcon,
  Button,
  DesktopTable,
  DesktopTablePagination,
  FilterSelect,
  GroupedSurface,
  MoneyValue,
  SearchInput,
  SegmentedTabs,
  StatusBadge,
  useListDetailFocus,
  type DesktopTableColumn,
  type SelectOption,
} from "@/components/ui";
import {
  useExpenseDesktopQuery,
  useExpenseDesktopTable,
} from "../../hooks/use-expense-desktop-query";
import type {
  VendorBillSubTab,
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import {
  getBillPaymentSummary,
  getVendorPaymentPresentation,
} from "@/features/expenses/utils/vendor-bill-list-utils";
import {
  filterDesktopVendorBills,
  filterDesktopVendorPayments,
  formatVendorDate,
  vendorBillPresentation,
  vendorPaymentTone,
  type VendorDateFilter,
  type VendorDesktopFilters,
} from "@/features/expenses/utils/vendor-desktop-presentation";
import { VendorDesktopBillDetail, VendorDesktopPaymentDetail } from "./vendor-desktop-detail";

const billColumns: readonly DesktopTableColumn<VendorListBill>[] = [
  {
    key: "bill",
    label: "Tagihan",
    sortValue: (bill) => bill.billNumber,
    render: (bill) => (
      <div className="max-w-56 min-w-36 space-y-1">
        <p className="font-semibold wrap-anywhere">{bill.billNumber}</p>
        <p className="text-support text-on-surface-variant">{bill.vendor?.name ?? "Vendor"}</p>
      </div>
    ),
  },
  {
    key: "project",
    label: "Proyek",
    sortValue: (bill) => bill.project?.name ?? "",
    render: (bill) => (
      <span className="block max-w-44 min-w-28 text-support wrap-anywhere">
        {bill.project?.name ?? "Proyek"}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Nominal",
    align: "end",
    sortValue: (bill) => Number(bill.amount),
    render: (bill) => (
      <MoneyValue
        amount={Number(bill.amount)}
        fractionDigits={Number.isInteger(Number(bill.amount)) ? 0 : 2}
        variant="compact"
        size="sm"
      />
    ),
  },
  {
    key: "due",
    label: "Jatuh tempo",
    sortValue: (bill) => new Date(bill.dueDate).getTime(),
    render: (bill) => (
      <span className="block min-w-24 text-support whitespace-nowrap">
        {formatVendorDate(bill.dueDate)}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortValue: (bill) => vendorBillPresentation(bill).label,
    render: (bill) => <StatusBadge {...vendorBillPresentation(bill)} />,
  },
];

const paymentColumns: readonly DesktopTableColumn<VendorListPayment>[] = [
  {
    key: "bill",
    label: "Pembayaran",
    sortValue: (payment) => payment.vendorBill?.billNumber ?? "",
    render: (payment) => (
      <div className="max-w-56 min-w-36 space-y-1">
        <p className="font-semibold wrap-anywhere">
          {payment.vendorBill?.billNumber ?? "Pembayaran vendor"}
        </p>
        <p className="text-support text-on-surface-variant">
          {payment.vendorBill?.vendor?.name ?? "Vendor"}
        </p>
      </div>
    ),
  },
  {
    key: "project",
    label: "Proyek",
    sortValue: (payment) => payment.vendorBill?.project?.name ?? "",
    render: (payment) => (
      <span className="block max-w-44 min-w-28 text-support wrap-anywhere">
        {payment.vendorBill?.project?.name ?? "Proyek"}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Nominal",
    align: "end",
    sortValue: (payment) => Number(payment.amountPaid),
    render: (payment) => (
      <MoneyValue
        amount={Number(payment.amountPaid)}
        fractionDigits={Number.isInteger(Number(payment.amountPaid)) ? 0 : 2}
        variant="compact"
        size="sm"
      />
    ),
  },
  {
    key: "date",
    label: "Tanggal",
    sortValue: (payment) => new Date(payment.paymentDate).getTime(),
    render: (payment) => (
      <span className="text-support whitespace-nowrap">
        {formatVendorDate(payment.paymentDate)}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortValue: (payment) => getVendorPaymentPresentation(payment).label,
    render: (payment) => (
      <StatusBadge
        label={getVendorPaymentPresentation(payment).label}
        tone={vendorPaymentTone(payment)}
      />
    ),
  },
];

function nameOptions(names: readonly (string | undefined)[], all: string): readonly SelectOption[] {
  const unique = [...new Set(names.filter((name): name is string => Boolean(name)))];
  return [
    { value: "", label: all },
    ...unique
      .sort((a, b) => a.localeCompare(b, "id-ID"))
      .map((name) => ({ value: name, label: name })),
  ];
}

const billStatuses: readonly SelectOption[] = [
  { value: "ACTIVE", label: "Belum lunas" },
  { value: "UNPAID", label: "Belum dibayar" },
  { value: "PARTIALLY_PAID", label: "Dibayar sebagian" },
  { value: "PAID", label: "Lunas" },
  { value: "VOID", label: "Dibatalkan" },
  { value: "ALL", label: "Semua status" },
];
const paymentStatuses: readonly SelectOption[] = [
  { value: "ACTIVE", label: "Belum cair" },
  { value: "READY", label: "Siap cair" },
  { value: "WAITING", label: "Menunggu Owner" },
  { value: "REJECTED", label: "Ditolak Owner" },
  { value: "PROCESSING", label: "Sedang diproses" },
  { value: "FAILED", label: "Gagal cair" },
  { value: "COMPLETED", label: "Selesai cair" },
  { value: "ALL", label: "Semua status" },
];

export function VendorDesktopWorkspace({
  projectId,
  vendorBills,
  vendorPayments,
  subTab,
  onSubTabChange,
  selectedBillId,
  selectedPaymentId,
  onSelectBill,
  onSelectPayment,
  canPay,
  canCreateVendorBill,
  onAddBill,
  onSchedule,
  onDisburse,
  pending = false,
}: {
  readonly projectId?: string;
  readonly vendorBills: readonly VendorListBill[];
  readonly vendorPayments: readonly VendorListPayment[];
  readonly subTab: VendorBillSubTab;
  readonly onSubTabChange: (value: VendorBillSubTab) => void;
  readonly selectedBillId: string | null;
  readonly selectedPaymentId: string | null;
  readonly onSelectBill: (id: string | null) => void;
  readonly onSelectPayment: (id: string | null) => void;
  readonly canPay: boolean;
  readonly canCreateVendorBill: boolean;
  readonly onAddBill: () => void;
  readonly onSchedule: (bill: VendorListBill) => void;
  readonly onDisburse: (payment: VendorListPayment) => void;
  readonly pending?: boolean;
}): React.JSX.Element {
  const detailAsideVisible = useWorkspaceViewportAtLeast(1280);
  const queryState = useExpenseDesktopQuery(projectId, "vendor");
  const search = queryState.read("search", "");
  const project = projectId ? "" : queryState.read("project", "");
  const vendor = queryState.read("vendor", "");
  const billStatus = queryState.read("bill-status", "ACTIVE");
  const paymentStatus = queryState.read("payment-status", "ACTIVE");
  const requestedDate = queryState.read("date", "ALL");
  const date: VendorDateFilter =
    requestedDate === "OVERDUE" || requestedDate === "WEEK" || requestedDate === "MONTH"
      ? requestedDate
      : "ALL";
  const setSearch = (value: string): void => queryState.update({ search: value });
  const setProject = (value: string): void => queryState.update({ project: value });
  const setVendor = (value: string): void => queryState.update({ vendor: value });
  const setBillStatus = (value: string): void => queryState.update({ "bill-status": value });
  const setPaymentStatus = (value: string): void => queryState.update({ "payment-status": value });
  const setDate = (value: string): void => queryState.update({ date: value });
  const displayedBillColumns = projectId
    ? billColumns.filter((column) => column.key !== "project")
    : billColumns;
  const displayedPaymentColumns = projectId
    ? paymentColumns.filter((column) => column.key !== "project")
    : paymentColumns;
  // Data and filter rerenders use the current Jakarta calendar cutoff without polling.
  const now = new Date();
  const sharedFilters = { search, project, vendor, date };
  const filters: VendorDesktopFilters = {
    ...sharedFilters,
    status: subTab === "BILLS" ? billStatus : paymentStatus,
  };
  const filteredBills = filterDesktopVendorBills(
    vendorBills,
    { ...sharedFilters, status: billStatus },
    now,
  );
  const filteredPayments = filterDesktopVendorPayments(
    vendorPayments,
    { ...sharedFilters, status: paymentStatus },
    now,
  );
  const filterKey = JSON.stringify(filters);
  const bills = useExpenseDesktopTable(filteredBills, displayedBillColumns, {
    query: queryState,
    prefix: "bills-",
    initialSort: { column: "due", direction: "ascending" },
    filterKey,
    rowKey: (bill) => bill.id,
  });
  const payments = useExpenseDesktopTable(filteredPayments, displayedPaymentColumns, {
    query: queryState,
    prefix: "payments-",
    initialSort: { column: "date", direction: "ascending" },
    filterKey,
    rowKey: (payment) => payment.id,
  });
  const selectedBill = bills.rows.find((bill) => bill.id === selectedBillId);
  const selectedPayment = payments.rows.find((payment) => payment.id === selectedPaymentId);
  const billContext = selectedBill;
  const paymentContext = selectedPayment;
  const hasContext = Boolean(subTab === "BILLS" ? billContext : paymentContext);
  const detailSelected = subTab === "BILLS" ? Boolean(selectedBill) : Boolean(selectedPayment);
  const activeContext = subTab === "BILLS" ? billContext : paymentContext;
  const { listRef, detailRef } = useListDetailFocus({
    active: useWorkspacePresentation() === "desktop",
    narrow: !detailAsideVisible,
    selectionKey: activeContext ? `${subTab}:${activeContext.id}` : null,
  });
  const openBills = vendorBills.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID");
  const outstanding = openBills.reduce(
    (sum, bill) =>
      sum + Math.max(0, Number(bill.amount) - getBillPaymentSummary(bill).completedPaymentAmount),
    0,
  );
  const scheduled = vendorPayments
    .filter((payment) => payment.status === "PENDING" || payment.status === "PROCESSING")
    .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  const paid = vendorPayments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  const projectOptions = nameOptions(
    [
      ...vendorBills.map((bill) => bill.project?.name),
      ...vendorPayments.map((payment) => payment.vendorBill?.project?.name),
    ],
    "Semua proyek",
  );
  const vendorOptions = nameOptions(
    [
      ...vendorBills.map((bill) => bill.vendor?.name),
      ...vendorPayments.map((payment) => payment.vendorBill?.vendor?.name),
    ],
    "Semua vendor",
  );
  const dateOptions: readonly SelectOption[] = [
    { value: "ALL", label: subTab === "BILLS" ? "Semua jatuh tempo" : "Semua tanggal" },
    { value: "OVERDUE", label: subTab === "BILLS" ? "Lewat jatuh tempo" : "Sebelum hari ini" },
    { value: "WEEK", label: "7 hari mendatang" },
    { value: "MONTH", label: "30 hari mendatang" },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <GroupedSurface
        variant="desktopPanel"
        className="grid grid-cols-2 gap-y-3 divide-x divide-outline-variant/40 p-4 lg:grid-cols-4"
      >
        <div className="min-w-0 pr-4">
          <p className="text-support text-on-surface-variant">Tagihan terbuka</p>
          <p className="mt-1 text-title font-bold tabular-nums">{openBills.length}</p>
        </div>
        <div className="min-w-0 px-4">
          <p className="text-support text-on-surface-variant">Belum dibayar</p>
          <MoneyValue
            amount={outstanding}
            fractionDigits={Number.isInteger(outstanding) ? 0 : 2}
            variant="compact"
            size="md"
            className="mt-1"
          />
        </div>
        <div className="min-w-0 px-4">
          <p className="text-support text-on-surface-variant">Dalam antrean</p>
          <MoneyValue
            amount={scheduled}
            fractionDigits={Number.isInteger(scheduled) ? 0 : 2}
            variant="compact"
            size="md"
            className="mt-1"
          />
        </div>
        <div className="min-w-0 pl-4">
          <p className="text-support text-on-surface-variant">Sudah dibayar</p>
          <MoneyValue
            amount={paid}
            fractionDigits={Number.isInteger(paid) ? 0 : 2}
            variant="compact"
            size="md"
            className="mt-1"
          />
        </div>
      </GroupedSurface>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={subTab}
          onChange={onSubTabChange}
          ariaLabel="Tampilan tagihan vendor"
          density="compact"
          options={[
            {
              value: "BILLS",
              label: "Tagihan",
              count: openBills.length,
              icon: <AppIcon name="request_quote" className="icon-sm" />,
            },
            {
              value: "PAYMENTS",
              label: "Pembayaran",
              count: vendorPayments.filter((payment) => payment.status !== "COMPLETED").length,
              icon: <AppIcon name="payments" className="icon-sm" />,
            },
          ]}
        />
        {canCreateVendorBill ? (
          <Button
            variant="primary"
            size="compact"
            leadingIcon={<AppIcon name="add" className="icon-sm" />}
            onClick={onAddBill}
          >
            Tambah tagihan
          </Button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={projectId ? "Cari nomor atau vendor…" : "Cari nomor, vendor, atau proyek…"}
          ariaLabel="Cari tagihan dan pembayaran vendor"
          showClear={false}
          className="w-64 min-w-0 grow"
        />
        {!projectId ? (
          <div className="max-w-48">
            <FilterSelect
              label="Proyek tagihan"
              value={project}
              onChange={setProject}
              options={projectOptions}
            />
          </div>
        ) : null}
        <div className="max-w-48">
          <FilterSelect
            label="Vendor tagihan"
            value={vendor}
            onChange={setVendor}
            options={vendorOptions}
          />
        </div>
        <FilterSelect
          label={subTab === "BILLS" ? "Status tagihan" : "Status pembayaran"}
          value={filters.status}
          onChange={subTab === "BILLS" ? setBillStatus : setPaymentStatus}
          options={subTab === "BILLS" ? billStatuses : paymentStatuses}
          presentation="menu"
        />
        <FilterSelect
          label={subTab === "BILLS" ? "Jatuh tempo tagihan" : "Tanggal pembayaran"}
          value={date}
          onChange={(value) => {
            if (value === "ALL" || value === "OVERDUE" || value === "WEEK" || value === "MONTH")
              setDate(value);
          }}
          options={dateOptions}
          presentation="menu"
        />
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${hasContext ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
      >
        <div ref={listRef} className={`${detailSelected ? "hidden xl:block" : ""} min-w-0`}>
          {subTab === "BILLS" ? (
            <DesktopTable
              ariaLabel="Tagihan vendor"
              columns={displayedBillColumns}
              rows={bills.rows}
              rowKey={(bill) => bill.id}
              selectedRowKey={detailAsideVisible ? (billContext?.id ?? null) : null}
              onRowSelectionChange={(bill) => {
                if (!pending) onSelectBill(bill?.id ?? null);
              }}
              sortDescriptor={bills.sortDescriptor}
              onSortChange={bills.onSortChange}
              emptyTitle={
                vendorBills.length ? "Tidak ada tagihan yang sesuai" : "Belum ada tagihan vendor"
              }
              emptyDescription={
                vendorBills.length
                  ? "Sesuaikan pencarian atau filter untuk melihat tagihan."
                  : "Tagihan yang dicatat akan muncul di sini."
              }
              footer={<DesktopTablePagination {...bills} ariaLabel="Halaman tagihan vendor" />}
            />
          ) : (
            <DesktopTable
              ariaLabel="Rencana pembayaran vendor"
              columns={displayedPaymentColumns}
              rows={payments.rows}
              rowKey={(payment) => payment.id}
              selectedRowKey={detailAsideVisible ? (paymentContext?.id ?? null) : null}
              onRowSelectionChange={(payment) => {
                if (!pending) onSelectPayment(payment?.id ?? null);
              }}
              sortDescriptor={payments.sortDescriptor}
              onSortChange={payments.onSortChange}
              emptyTitle={
                vendorPayments.length
                  ? "Tidak ada pembayaran yang sesuai"
                  : "Belum ada rencana pembayaran"
              }
              emptyDescription={
                vendorPayments.length
                  ? "Sesuaikan pencarian atau filter untuk melihat pembayaran."
                  : "Jadwal dan riwayat pencairan vendor akan muncul di sini."
              }
              footer={
                <DesktopTablePagination {...payments} ariaLabel="Halaman pembayaran vendor" />
              }
            />
          )}
        </div>
        {hasContext ? (
          <div ref={detailRef} className={`${detailSelected ? "" : "hidden xl:block"} min-w-0`}>
            {subTab === "BILLS" && billContext ? (
              <VendorDesktopBillDetail
                bill={billContext}
                canPay={canPay}
                onSchedule={onSchedule}
                onBack={() => {
                  if (!pending) onSelectBill(null);
                }}
              />
            ) : subTab === "PAYMENTS" && paymentContext ? (
              <VendorDesktopPaymentDetail
                payment={paymentContext}
                canPay={canPay}
                onDisburse={onDisburse}
                onBack={() => {
                  if (!pending) onSelectPayment(null);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
