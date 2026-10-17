"use client";

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
  SectionHeader,
  SegmentedTabs,
  desktopTablePage,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useBrowserUrlSearchParam, updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import type { ClientInvoiceItem } from "../../types/project-invoices-types";
import { calculateInvoiceSettlementStatus } from "../../utils/project-invoices-utils";
import {
  filterProjectInvoices,
  filterProjectReceipts,
  projectReceiptRows,
  projectInvoiceDisplayStatus,
  type ProjectPaymentsQuery,
  type ProjectPaymentsView,
  type ProjectReceiptRow,
} from "./project-payments-desktop-model";
import { projectInvoiceColumns, projectReceiptColumns } from "./project-payments-desktop-columns";
import { InvoiceDesktopDetail, ReceiptDesktopDetail } from "./project-payments-desktop-details";
import { useProjectPaymentsQuery } from "./use-project-payments-query";

// THESIS: separate the client's billing schedule from cash actually received.
// Atria Operate: one divided financial band, native tables, independent record context.
// Existing workflows own all create/receipt/review/recovery/focus/pending behavior.
function PaymentsCollection<Row extends object>({
  kind,
  active,
  rows,
  columns,
  filter,
  rowKey,
  renderDetail,
}: {
  readonly kind: ProjectPaymentsView;
  readonly active: boolean;
  readonly rows: readonly Row[];
  readonly columns: readonly DesktopTableColumn<Row>[];
  readonly filter: (rows: readonly Row[], input: ProjectPaymentsQuery) => readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly renderDetail: (row: Row) => React.ReactNode;
}): React.JSX.Element {
  const { input, update } = useProjectPaymentsQuery(kind);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const wide = useWorkspaceViewportAtLeast(1280);
  const table = desktopTablePage(
    filter(rows, input),
    columns,
    rowKey,
    { column: input.sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((row) => rowKey(row) === selectedId);
  const context = explicit;
  React.useEffect((): void => {
    if (active && table.page !== input.page) update({ page: table.page });
  }, [active, table.page, input.page, update]);
  function changeFilters(patch: Partial<ProjectPaymentsQuery>): void {
    setSelectedId(null);
    update(patch);
  }
  return (
    <section
      hidden={!active}
      inert={!active}
      aria-label={kind === "invoices" ? "Daftar invoice proyek" : "Daftar penerimaan proyek"}
      className="min-w-0 space-y-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel={kind === "invoices" ? "Cari invoice proyek" : "Cari penerimaan proyek"}
          value={input.search}
          onChange={(search): void => changeFilters({ search })}
          showClear={false}
          placeholder={
            kind === "invoices" ? "Cari nomor invoice atau termin…" : "Cari invoice atau referensi…"
          }
          className="min-w-0 flex-1 basis-64"
        />
        {kind === "invoices" && (
          <FilterSelect
            label="Status invoice"
            presentation="menu"
            value={input.status}
            onChange={(status): void => changeFilters({ status })}
            options={[
              { value: "all", label: "Semua status" },
              { value: "active", label: "Invoice aktif" },
              { value: "UNPAID", label: "Belum dibayar" },
              { value: "PARTIALLY_PAID", label: "Sebagian" },
              { value: "OVERDUE", label: "Terlambat" },
              { value: "PAID", label: "Lunas" },
              { value: "VOID", label: "Dibatalkan" },
            ]}
          />
        )}
        <FilterSelect
          label={kind === "invoices" ? "Jatuh tempo invoice" : "Tanggal penerimaan"}
          presentation="menu"
          value={input.date}
          onChange={(date): void => changeFilters({ date })}
          options={[
            { value: "all", label: kind === "invoices" ? "Semua jatuh tempo" : "Semua tanggal" },
            { value: "this-month", label: "Bulan ini" },
            { value: "last-month", label: "Bulan lalu" },
          ]}
        />
      </div>
      {!wide && explicit && (
        <Button
          type="button"
          variant="secondary"
          size="compact"
          leadingIcon={<AppIcon name="arrow_back" />}
          onClick={(): void => setSelectedId(null)}
        >
          Kembali ke daftar
        </Button>
      )}
      <div
        className={`grid min-w-0 items-start gap-4 ${wide && context ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1"}`}
      >
        <div hidden={!wide && Boolean(explicit)} className="min-w-0">
          <DesktopTable
            ariaLabel={kind === "invoices" ? "Invoice klien proyek" : "Penerimaan kas proyek"}
            layout="fixed"
            rows={table.rows}
            columns={columns}
            rowKey={rowKey}
            selectedRowKey={wide ? (context ? rowKey(context) : null) : null}
            onRowSelectionChange={(row): void => setSelectedId(row ? rowKey(row) : null)}
            sortDescriptor={{ column: input.sort, direction: input.direction }}
            onSortChange={(sort): void =>
              changeFilters({ sort: String(sort.column), direction: sort.direction })
            }
            emptyTitle={
              rows.length
                ? "Tidak ada hasil"
                : kind === "invoices"
                  ? "Belum ada invoice"
                  : "Belum ada penerimaan"
            }
            emptyDescription={
              rows.length
                ? "Sesuaikan pencarian atau filter."
                : kind === "invoices"
                  ? "Buat invoice saat termin penagihan klien sudah siap."
                  : "Penerimaan muncul setelah pembayaran klien dicatat melalui invoice."
            }
            footer={
              <DesktopTablePagination
                ariaLabel={
                  kind === "invoices" ? "Halaman invoice proyek" : "Halaman penerimaan proyek"
                }
                page={table.page}
                pageSize={input.pageSize}
                total={table.total}
                onPageChange={(page): void => changeFilters({ page })}
                onPageSizeChange={(pageSize): void =>
                  changeFilters({ pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10 })
                }
              />
            }
          />
        </div>
        {context && renderDetail(context)}
      </div>
    </section>
  );
}
export function ProjectPaymentsDesktop({
  invoices,
  contractValue,
  canCreateInvoice,
  canRecordPayment,
  locked,
  schedulePending,
  createError,
  createSuccess,
  onCreateInvoice,
  onGenerateSchedule,
  onRecordPayment,
  onOpenInvoice,
  onOpenReceipt,
  onNavigateClosing,
  active = true,
}: {
  readonly active?: boolean;
  readonly invoices: readonly ClientInvoiceItem[];
  readonly contractValue: number;
  readonly canCreateInvoice: boolean;
  readonly canRecordPayment: boolean;
  readonly locked: boolean;
  readonly schedulePending: boolean;
  readonly createError: string | null;
  readonly createSuccess: string | null;
  readonly onCreateInvoice: () => void;
  readonly onGenerateSchedule: () => void;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
  readonly onOpenInvoice: (invoice: ClientInvoiceItem) => void;
  readonly onOpenReceipt: (id: string) => void;
  readonly onNavigateClosing?: () => void;
}): React.JSX.Element {
  const viewParam = useBrowserUrlSearchParam("payments-view");
  const view: ProjectPaymentsView = viewParam === "receipts" ? "receipts" : "invoices";
  const totals = calculateInvoiceSettlementStatus(invoices, contractValue);
  const receipts = projectReceiptRows(invoices);
  const overdueCount = invoices.filter(
    (invoice) => projectInvoiceDisplayStatus(invoice) === "OVERDUE",
  ).length;
  const hasVoidReceipts = invoices.some(
    (invoice) => invoice.status === "VOID" && invoice.payments.length > 0,
  );
  const metrics = [
    { label: "Invoice aktif", amount: totals.totalInvoiceAmount },
    { label: "Kas diterima", amount: totals.totalPaidAmount },
    { label: "Sisa piutang", amount: totals.unpaidAmount },
    { label: "Belum ditagihkan", amount: totals.unbilledContractAmount },
  ];
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <SectionHeader title="Penagihan klien" />
          <p className="px-1 text-support text-on-surface-variant">
            Pantau termin invoice, piutang dan penerimaan kas proyek.
          </p>
        </div>
        {canCreateInvoice && (
          <div className="flex flex-wrap items-center gap-2">
            {totals.activeInvoicesCount === 0 && (
              <Button
                type="button"
                variant="secondary"
                size="compact"
                disabled={schedulePending || contractValue <= 0}
                onClick={onGenerateSchedule}
              >
                {schedulePending ? "Membuat termin…" : "Buat jadwal termin"}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="compact"
              disabled={schedulePending}
              leadingIcon={<AppIcon name="add" />}
              onClick={onCreateInvoice}
            >
              Buat invoice
            </Button>
          </div>
        )}
      </div>
      <GroupedSurface variant="desktopPanel">
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/20 p-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 px-4 first:pl-0 last:pr-0">
              <dt className="text-support text-on-surface-variant">{metric.label}</dt>
              <dd className="mt-1">
                <MoneyValue amount={metric.amount} variant="compact" size="lg" />
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 px-4 py-3">
          <p className="flex flex-wrap items-center gap-x-2 text-support text-on-surface-variant">
            <span>Nilai kontrak</span>
            <MoneyValue
              amount={contractValue}
              variant="fullDynamic"
              fractionDigits={Number.isInteger(contractValue) ? 0 : 2}
              size="xs"
            />
            <span>
              · {totals.activeInvoicesCount} invoice aktif · {receipts.length} penerimaan
            </span>
            {overdueCount > 0 && <span className="text-error">· {overdueCount} terlambat</span>}
          </p>
          {totals.isFullySettled && onNavigateClosing && (
            <Button type="button" variant="secondary" size="compact" onClick={onNavigateClosing}>
              Cek kesiapan closing
            </Button>
          )}
        </div>
      </GroupedSurface>
      {hasVoidReceipts && (
        <p className="px-1 text-support text-on-surface-variant">
          Kas diterima mencakup riwayat penerimaan dari invoice yang dibatalkan.
        </p>
      )}
      {locked && (
        <p className="px-1 text-support text-on-surface-variant">
          Proyek terkunci. Invoice dan penerimaan tetap dapat ditinjau.
        </p>
      )}
      {!locked && !canCreateInvoice && !canRecordPayment && (
        <p className="px-1 text-support text-on-surface-variant">
          Akses baca saja. Pembuatan invoice dan pencatatan penerimaan mengikuti izin akun.
        </p>
      )}
      {contractValue <= 0 && canCreateInvoice && (
        <p className="px-1 text-support text-on-surface-variant">
          Isi nilai kontrak proyek terlebih dahulu untuk membuat jadwal termin.
        </p>
      )}
      {createError && (
        <p role="alert" className="px-1 text-support text-error">
          {createError}
        </p>
      )}
      {createSuccess && (
        <p role="status" className="px-1 text-support text-on-surface-variant">
          {createSuccess}
        </p>
      )}
      <SegmentedTabs
        value={view}
        onChange={(value: ProjectPaymentsView): void => {
          updateUrlSearchParam("payments-view", value, "replace");
        }}
        ariaLabel="Koleksi pembayaran proyek"
        density="compact"
        options={[
          {
            value: "invoices",
            label: "Invoice",
            icon: <AppIcon name="receipt_long" />,
            count: invoices.length,
            countLabel: `${invoices.length} invoice`,
          },
          {
            value: "receipts",
            label: "Penerimaan",
            icon: <AppIcon name="payments" />,
            count: receipts.length,
            countLabel: `${receipts.length} penerimaan`,
          },
        ]}
      />
      <PaymentsCollection
        kind="invoices"
        active={active && view === "invoices"}
        rows={invoices}
        columns={projectInvoiceColumns}
        filter={filterProjectInvoices}
        rowKey={(row: ClientInvoiceItem): string => row.id}
        renderDetail={(invoice: ClientInvoiceItem): React.JSX.Element => (
          <InvoiceDesktopDetail
            invoice={invoice}
            canRecordPayment={canRecordPayment}
            onRecordPayment={onRecordPayment}
            onOpenInvoice={onOpenInvoice}
            onOpenReceipt={onOpenReceipt}
          />
        )}
      />
      <PaymentsCollection
        kind="receipts"
        active={active && view === "receipts"}
        rows={receipts}
        columns={projectReceiptColumns}
        filter={filterProjectReceipts}
        rowKey={(row: ProjectReceiptRow): string => row.id}
        renderDetail={(receipt: ProjectReceiptRow): React.JSX.Element => (
          <ReceiptDesktopDetail
            receipt={receipt}
            onOpenInvoice={onOpenInvoice}
            onOpenReceipt={onOpenReceipt}
          />
        )}
      />
    </div>
  );
}
