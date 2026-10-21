"use client";

/* THESIS: compare bank evidence with Atria records before explicitly matching.
 * OWN-WORLD: Atria Operate; Manrope, cool canvas, compact white owners,
 * native HeroUI tables, ink capsule actions and restrained terracotta status.
 * STORY: scan unmatched counts, choose a source/filter, inspect both sides,
 * then continue through the existing protected reconciliation workflow.
 * FIRST VIEWPORT: compact title/actions, divided four-fact band, three peer
 * tabs, inline filters, six-column table and independent 18rem context aside.
 * FORM: the user's approved Dashboard/Expenses desktop grammar; narrower
 * desktop progresses list/detail without highlighting a hidden selection.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import React from "react";
import {
  AppIcon,
  Button,
  DesktopTable,
  DesktopTablePagination,
  FilterSelect,
  GroupedSurface,
  MoneyValue,
  PageHeader,
  PageState,
  SearchInput,
  SegmentedTabs,
  StatusBadge,
  useListDetailFocus,
  type DesktopTableColumn,
} from "@/components/ui";
import type {
  ReconciliationDesktopData,
  ReconciliationDesktopInput,
  ReconciliationHistoryRow,
} from "@atria/core/finance/reconciliation-desktop";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useReconciliationDesktop } from "../hooks/use-reconciliation-desktop";
import { readReconciliationMatchContext } from "../hooks/reconciliation-read-client";
import { cashDisplayTitle } from "../utils/reconciliation-cash-copy";
import { type ReconciliationView } from "./reconciliation-primitives";
import {
  ReconciliationDesktopDetail,
  type ReconciliationDesktopSelection,
} from "./reconciliation-desktop-detail";
import { ReconciliationDesktopSkeleton } from "./reconciliation-desktop-skeleton";

type Row = ReconciliationDesktopSelection;
type DetailReadScope = {
  readonly context: Row | undefined;
  readonly active: boolean;
  readonly suspended: boolean;
};

function rowsFrom(data: ReconciliationDesktopData | null): readonly Row[] {
  if (data?.view === "cash")
    return data.rows.map((item) => ({ kind: "cash", item, statements: [] }));
  if (data?.view === "statement")
    return data.rows.map((item) => ({ kind: "statement", item, cashTransactions: [] }));
  if (data?.view === "history") return data.rows.map((item) => ({ kind: "history", item }));
  return [];
}

function rowTitle(row: Row): string {
  return row.kind === "cash"
    ? cashDisplayTitle(row.item)
    : row.kind === "history"
      ? row.item.cashDescription
      : row.item.description;
}
function rowDate(row: Row): Date {
  return row.kind === "cash"
    ? row.item.createdAt
    : row.kind === "history"
      ? row.item.reconciledAt
      : row.item.transactionDate;
}
function dateCopy(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
function rowStatus(row: Row): string {
  if (row.kind === "history") return "Sudah cocok";
  if (row.kind === "cash") return row.item.exceptionReason ? "Pengecualian" : "Belum cocok";
  return row.item.candidateCount > 0 ? "Ada kandidat" : "Belum ada kandidat";
}

const columns: readonly DesktopTableColumn<Row>[] = [
  {
    key: "description",
    label: "Keterangan",
    widthPercent: 29,
    sortable: true,
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 font-semibold">{rowTitle(row)}</p>
        {row.kind === "cash" && row.item.source ? (
          <p
            className="truncate text-support text-on-surface-variant"
            title={row.item.source.projectName}
          >
            {row.item.source.projectName}
          </p>
        ) : row.kind === "history" ? (
          <p
            className="line-clamp-1 text-support text-on-surface-variant"
            title={row.item.statementDescription}
          >
            {row.item.statementDescription}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: "account",
    label: "Rekening",
    widthPercent: 15,
    sortable: true,
    render: (row) => (
      <span className="block truncate text-support" title={row.item.bankAccountName}>
        {row.item.bankAccountName}
      </span>
    ),
  },
  {
    key: "date",
    label: "Tanggal",
    widthPercent: 15,
    sortable: true,
    render: (row) => (
      <span className="text-support whitespace-nowrap tabular-nums">{dateCopy(rowDate(row))}</span>
    ),
  },
  {
    key: "direction",
    label: "Arah",
    widthPercent: 10,
    sortable: false,
    render: (row) => (
      <span className="inline-flex items-center gap-1 text-support">
        <AppIcon
          name={row.item.type === "INFLOW" ? "south_west" : "north_east"}
          className="icon-xs shrink-0"
        />
        {row.item.type === "INFLOW" ? "Masuk" : "Keluar"}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Nominal",
    align: "end",
    widthPercent: 14,
    sortable: true,
    render: (row) => (
      <MoneyValue
        amount={row.item.amount}
        fractionDigits={Number.isInteger(row.item.amount) ? 0 : 2}
        variant="compact"
        size="sm"
      />
    ),
  },
  {
    key: "status",
    label: "Status",
    widthPercent: 17,
    sortable: true,
    render: (row) => (
      <div className="space-y-1">
        <StatusBadge
          label={rowStatus(row)}
          tone={row.kind === "cash" && row.item.exceptionReason ? "warning" : "neutral"}
        />
        {row.kind === "statement" && row.item.candidateCount > 0 ? (
          <p className="text-meta text-on-surface-variant">
            {row.item.candidateCount} kandidat · perlu ditinjau
          </p>
        ) : row.kind === "cash" && !row.item.exceptionReason && row.item.ageDays > 3 ? (
          <p className="text-meta text-warning">Menunggu {row.item.ageDays} hari</p>
        ) : null}
      </div>
    ),
  },
];

function isSort(value: unknown): value is ReconciliationDesktopInput["sort"] {
  return (
    value === "description" ||
    value === "account" ||
    value === "date" ||
    value === "amount" ||
    value === "status"
  );
}

export function ReconciliationDesktopWorkspace({
  active,
  activeView,
  onChangeView,
  refreshToken,
  suspended,
  pending,
  onOpenImport,
  onOpenManual,
  onOpenMatch,
  onOpenHistory,
  matchReturnFocusRef,
}: {
  readonly active: boolean;
  readonly activeView: ReconciliationView;
  readonly onChangeView: (view: ReconciliationView) => void;
  readonly refreshToken: object;
  readonly suspended: boolean;
  readonly pending: boolean;
  readonly onOpenImport: () => void;
  readonly onOpenManual: () => void;
  readonly onOpenMatch: (cashId: string, statementId?: string) => void;
  readonly onOpenHistory: (item: ReconciliationHistoryRow) => void;
  readonly matchReturnFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const query = useReconciliationDesktop({ view: activeView, active, refreshToken, suspended });
  const asideVisible = useWorkspaceViewportAtLeast(1280);
  const [selected, setSelected] = React.useState<{ view: ReconciliationView; id: string } | null>(
    null,
  );
  const rows = React.useMemo(
    () => (query.loading ? [] : rowsFrom(query.data)),
    [query.data, query.loading],
  );
  const tableColumns = React.useMemo(
    () =>
      activeView === "history"
        ? columns.map((column) =>
            column.key === "date" ? { ...column, label: "Dikonfirmasi" } : column,
          )
        : columns,
    [activeView],
  );
  const explicit =
    selected?.view === activeView ? rows.find((row) => row.item.id === selected.id) : undefined;
  const context = explicit;
  const { listRef, detailRef } = useListDetailFocus({
    active,
    narrow: !asideVisible,
    selectionKey: context ? `${context.kind}:${context.item.id}` : null,
  });
  const paneRef = React.useCallback(
    (element: HTMLElement | null): void => {
      detailRef(element);
      if (asideVisible && matchReturnFocusRef) matchReturnFocusRef.current = element;
    },
    [asideVisible, detailRef, matchReturnFocusRef],
  );
  const backReturnRef = React.useCallback(
    (element: HTMLButtonElement | null): void => {
      if (!asideVisible && matchReturnFocusRef) matchReturnFocusRef.current = element;
    },
    [asideVisible, matchReturnFocusRef],
  );
  const contextKey = context
    ? `${context.kind}:${context.item.id}:${query.data?.updatedAt.toISOString()}`
    : "";
  const detailReadScope = React.useMemo<DetailReadScope>(
    () => ({ context, active, suspended }),
    [context, active, suspended],
  );
  const [detail, setDetail] = React.useState<{
    key: string;
    scope: DetailReadScope;
    row: Row | null;
    error: string | null;
  } | null>(null);
  React.useEffect(() => {
    if (!active || suspended || !context || context.kind === "history") return;
    let current = true;
    void readReconciliationMatchContext(
      context.kind === "cash"
        ? { cashTransactionId: context.item.id }
        : { statementRowId: context.item.id },
    )
      .then((result) => {
        if (!current) return;
        setDetail({
          key: contextKey,
          scope: detailReadScope,
          row: result.success
            ? context.kind === "cash"
              ? { ...context, statements: result.data.statementRows }
              : { ...context, cashTransactions: result.data.cashTransactions }
            : null,
          error: result.success ? null : result.error.message,
        });
      })
      .catch(() => {
        if (current)
          setDetail({
            key: contextKey,
            scope: detailReadScope,
            row: null,
            error: "Pasangan belum dapat dimuat. Coba segarkan data.",
          });
      });
    return (): void => {
      current = false;
    };
  }, [active, context, contextKey, suspended, detailReadScope]);
  const detailRow =
    context?.kind === "history"
      ? context
      : detail?.key === contextKey && detail.scope === detailReadScope
        ? detail.row
        : null;
  const detailError =
    detail?.key === contextKey && detail.scope === detailReadScope ? detail.error : null;
  const data = query.data;
  const metadata = query.metadata;
  const hasFilters = Boolean(
    query.input.search ||
    query.input.accountId ||
    query.input.direction !== "all" ||
    query.input.status !== "all",
  );
  const sourceTime = metadata?.updatedAt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Rekonsiliasi"
        subtitle="Cocokkan catatan Paduna Build dengan mutasi bank."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="compact"
              variant="secondary"
              onClick={onOpenManual}
              disabled={
                pending || !metadata || query.accessDenied || metadata.bankAccounts.length === 0
              }
            >
              Catat mutasi
            </Button>
            <Button
              size="compact"
              variant="primary"
              onClick={onOpenImport}
              disabled={
                pending || !metadata || query.accessDenied || metadata.bankAccounts.length === 0
              }
            >
              <AppIcon name="upload_file" className="icon-sm" />
              Impor mutasi
            </Button>
          </div>
        }
      />
      {!metadata ? (
        query.error ? (
          <PageState
            kind={query.accessDenied ? "restricted" : "error"}
            title={
              query.accessDenied
                ? "Akses rekonsiliasi tidak tersedia"
                : "Rekonsiliasi belum dapat dimuat"
            }
            description={query.error}
            actionLabel="Coba lagi"
            onAction={query.reload}
          />
        ) : (
          <ReconciliationDesktopSkeleton view={activeView} region="body" />
        )
      ) : (
        <>
          <GroupedSurface variant="desktopPanel">
            <dl className="grid grid-cols-4 divide-x divide-outline-variant/30 p-4">
              {[
                { label: "Catatan perlu tindakan", value: metadata.counts.actionRequired },
                { label: "Mutasi belum cocok", value: metadata.counts.statement },
                { label: "Pengecualian", value: metadata.counts.exceptions },
                { label: "Sudah cocok", value: metadata.counts.history },
              ].map((fact) => (
                <div key={fact.label} className="min-w-0 px-4 first:pl-0 last:pr-0">
                  <dt className="text-support text-on-surface-variant">{fact.label}</dt>
                  <dd className="mt-1 text-title font-semibold tabular-nums">
                    {fact.value.toLocaleString("id-ID")}
                  </dd>
                </div>
              ))}
            </dl>
          </GroupedSurface>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <SegmentedTabs
              value={activeView}
              onChange={onChangeView}
              ariaLabel="Sumber rekonsiliasi"
              density="compact"
              scrollable
              options={[
                {
                  value: "statement",
                  label: "Mutasi bank",
                  count: metadata.counts.statement,
                  countLabel: `${metadata.counts.statement} mutasi belum cocok`,
                },
                {
                  value: "cash",
                  label: "Catatan Paduna Build",
                  count: metadata.counts.cash,
                  countLabel: `${metadata.counts.cash} catatan belum cocok`,
                },
                {
                  value: "history",
                  label: "Riwayat",
                  count: metadata.counts.history,
                  countLabel: `${metadata.counts.history} pencocokan terkonfirmasi`,
                },
              ]}
            />
            <Button size="mini" variant="secondary" disabled={pending} onClick={query.reload}>
              <AppIcon name="refresh" className="icon-xs" />
              Segarkan
              {sourceTime ? (
                <span className="text-meta text-on-surface-variant">{sourceTime}</span>
              ) : null}
            </Button>
          </div>
          {metadata.bankAccounts.length === 0 ? (
            <p className="flex items-center gap-2 text-support text-warning">
              <AppIcon name="info" className="icon-sm" />
              Tambahkan rekening aktif di Dashboard agar dapat mencatat atau mengimpor mutasi.
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchInput
              ariaLabel="Cari rekonsiliasi"
              placeholder="Cari keterangan atau rekening…"
              value={query.input.search}
              onChange={(search) => query.update({ search })}
              showClear={false}
              className="min-w-56 flex-1"
            />
            <FilterSelect
              label="Rekening rekonsiliasi"
              value={query.input.accountId ?? ""}
              onChange={(accountId) => query.update({ accountId: accountId || undefined })}
              presentation="menu"
              searchable={metadata.bankAccounts.length > 8}
              options={[
                { value: "", label: "Semua rekening" },
                ...metadata.bankAccounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                })),
              ]}
            />
            <FilterSelect
              label="Arah dana"
              value={query.input.direction}
              onChange={(direction) => {
                if (direction === "all" || direction === "INFLOW" || direction === "OUTFLOW")
                  query.update({ direction });
              }}
              presentation="menu"
              options={[
                { value: "all", label: "Semua arah" },
                { value: "INFLOW", label: "Dana masuk" },
                { value: "OUTFLOW", label: "Dana keluar" },
              ]}
            />
            {activeView !== "history" ? (
              <FilterSelect
                label="Status rekonsiliasi"
                value={query.input.status}
                onChange={(status) => {
                  if (
                    status === "all" ||
                    status === "actionable" ||
                    status === "exception" ||
                    status === "candidate" ||
                    status === "unmatched"
                  )
                    query.update({ status });
                }}
                presentation="menu"
                options={
                  activeView === "cash"
                    ? [
                        { value: "all", label: "Semua catatan" },
                        { value: "actionable", label: "Perlu tindakan" },
                        { value: "exception", label: "Pengecualian" },
                      ]
                    : [
                        { value: "all", label: "Semua mutasi" },
                        { value: "candidate", label: "Ada kandidat" },
                        { value: "unmatched", label: "Belum ada kandidat" },
                      ]
                }
              />
            ) : null}
            {hasFilters ? (
              <Button
                size="mini"
                variant="secondary"
                onClick={() =>
                  query.update({
                    search: "",
                    accountId: undefined,
                    direction: "all",
                    status: "all",
                  })
                }
              >
                Reset filter
              </Button>
            ) : null}
          </div>
          {query.error ? (
            <PageState
              kind={query.accessDenied ? "restricted" : "error"}
              title={
                query.accessDenied
                  ? "Akses rekonsiliasi tidak tersedia"
                  : "Rekonsiliasi belum dapat dimuat"
              }
              description={query.error}
              actionLabel="Coba lagi"
              onAction={query.reload}
            />
          ) : !data ? (
            <ReconciliationDesktopSkeleton view={activeView} region="table" />
          ) : (
            <div
              className={`grid min-w-0 items-start gap-4 ${context ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
            >
              <div ref={listRef} className={`min-w-0 ${explicit ? "hidden xl:block" : ""}`}>
                {query.loading ? (
                  <ReconciliationDesktopSkeleton view={activeView} region="table" />
                ) : (
                  <DesktopTable
                    ariaLabel={
                      activeView === "statement"
                        ? "Mutasi bank belum cocok"
                        : activeView === "cash"
                          ? "Catatan Paduna Build belum cocok"
                          : "Riwayat rekonsiliasi"
                    }
                    columns={tableColumns}
                    layout="fixed"
                    rows={rows}
                    rowKey={(row) => row.item.id}
                    selectedRowKey={asideVisible ? (context?.item.id ?? null) : null}
                    onRowSelectionChange={(row) => {
                      if (pending) return;
                      setSelected(row ? { view: activeView, id: row.item.id } : null);
                      if (!row) setDetail(null);
                    }}
                    sortDescriptor={{
                      column: query.input.sort,
                      direction: query.input.sortDirection,
                    }}
                    onSortChange={(sort) => {
                      if (isSort(sort.column))
                        query.update({ sort: sort.column, sortDirection: sort.direction });
                    }}
                    emptyTitle={
                      hasFilters
                        ? "Tidak ada hasil yang sesuai"
                        : activeView === "history"
                          ? "Belum ada pencocokan"
                          : activeView === "cash"
                            ? "Tidak ada catatan yang menunggu"
                            : "Belum ada mutasi yang menunggu"
                    }
                    emptyDescription={
                      hasFilters
                        ? "Sesuaikan pencarian atau filter untuk melihat catatan."
                        : activeView === "history"
                          ? "Pasangan yang dikonfirmasi akan tampil di sini."
                          : activeView === "statement"
                            ? "Impor atau catat mutasi bank untuk mulai mencocokkan."
                            : "Catatan kas baru yang belum cocok akan tampil di sini."
                    }
                    footer={
                      <DesktopTablePagination
                        page={data.page}
                        pageSize={data.pageSize}
                        total={data.total}
                        onPageChange={(page) => query.update({ page })}
                        onPageSizeChange={(pageSize) => {
                          if (pageSize === 10 || pageSize === 25 || pageSize === 50)
                            query.update({ pageSize });
                        }}
                        ariaLabel="Halaman rekonsiliasi"
                      />
                    }
                  />
                )}
              </div>
              {context ? (
                <section
                  ref={paneRef}
                  tabIndex={-1}
                  aria-label="Panel konteks rekonsiliasi"
                  className={`min-w-0 space-y-3 ${explicit ? "" : "hidden xl:block"}`}
                >
                  {explicit ? (
                    <Button
                      ref={backReturnRef}
                      size="mini"
                      variant="secondary"
                      className="xl:hidden"
                      onClick={() => {
                        if (!pending) setSelected(null);
                      }}
                    >
                      <AppIcon name="arrow_back" className="icon-xs" />
                      Kembali ke daftar
                    </Button>
                  ) : null}
                  {detailRow ? (
                    <ReconciliationDesktopDetail
                      selection={detailRow}
                      pending={pending}
                      onOpenMatch={onOpenMatch}
                      onOpenHistory={() => {
                        if (context.kind === "history") onOpenHistory(context.item);
                      }}
                    />
                  ) : detailError ? (
                    <PageState
                      compact
                      kind="error"
                      title="Rincian belum dapat dimuat"
                      description={detailError}
                      actionLabel="Coba lagi"
                      onAction={query.reload}
                    />
                  ) : (
                    <GroupedSurface variant="desktopPanel" className="p-4">
                      <p role="status" className="text-support text-on-surface-variant">
                        Memuat rincian dan kandidat pasangan…
                      </p>
                    </GroupedSurface>
                  )}
                </section>
              ) : null}
            </div>
          )}
          <p className="px-1 text-support text-on-surface-variant">
            Pencocokan memverifikasi rekening, arah dana, dan nominal. Saldo tidak berubah.
          </p>
        </>
      )}
    </div>
  );
}
