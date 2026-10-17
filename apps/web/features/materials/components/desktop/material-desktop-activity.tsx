"use client";

import React from "react";
import type {
  CountView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import type { MaterialDesktopActivityInput } from "@atria/core/material/material-desktop";
import {
  AppIcon,
  Button,
  DesktopTable,
  DesktopTablePagination,
  FilterSelect,
  PageState,
  SearchInput,
  SegmentedTabs,
  useListDetailFocus,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import {
  useMaterialDesktopActivity,
  type MaterialDesktopActivityKind,
} from "../../hooks/use-material-desktop-activity";
import type { MaterialOperationDecision } from "../../types/material-dashboard-types";
import { formatMaterialStatus, formatMovementType } from "../../utils/material-ui-utils";
import { MaterialDesktopActivityDetail } from "./material-desktop-activity-detail";
import { materialActivityColumns, materialActivityRows } from "./material-desktop-activity-rows";
import { MaterialDesktopSkeleton } from "./material-desktop-skeleton";

const kindCopy: Record<
  MaterialDesktopActivityKind,
  { readonly title: string; readonly empty: string; readonly description: string }
> = {
  movements: {
    title: "Gerakan stok",
    empty: "Belum ada gerakan stok",
    description: "Riwayat stok masuk, reservasi, pemakaian, dan koreksi akan tampil di sini.",
  },
  receipts: {
    title: "Penerimaan barang",
    empty: "Belum ada penerimaan barang",
    description: "Dokumen penerimaan mencatat barang fisik yang masuk ke lokasi proyek.",
  },
  transfers: {
    title: "Transfer stok",
    empty: "Belum ada transfer stok",
    description: "Dokumen perpindahan stok antarlokasi akan tampil di sini.",
  },
  counts: {
    title: "Stock opname",
    empty: "Belum ada stock opname",
    description: "Draft, hasil hitung, dan keputusan opname akan tampil di sini.",
  },
};
const movementTypes = [
  "OPENING_BALANCE",
  "STOCK_IN",
  "GOODS_RECEIPT",
  "RESERVE",
  "USE",
  "RETURN",
  "WASTE",
  "ADJUSTMENT",
  "STOCK_COUNT_ADJUSTMENT",
  "TRANSFER",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "GOODS_RECEIPT_REVERSAL",
];

function isActivitySort(value: unknown): value is MaterialDesktopActivityInput["sort"] {
  return (
    value === "date" ||
    value === "name" ||
    value === "quantity" ||
    value === "value" ||
    value === "status"
  );
}

export type MaterialDesktopActivityProps = {
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  readonly data: MaterialOperationsDashboard;
  readonly refreshToken?: object;
  readonly active: boolean;
  readonly suspended: boolean;
  readonly pending: boolean;
  readonly onOpenReceipt: (receipt: ReceiptView) => void;
  readonly onDecision: (decision: MaterialOperationDecision) => void;
  readonly onLoadCountDraft: (row: CountView) => void;
};

/** Stable collection owner stays mounted while the responsive shell changes. */
export function MaterialDesktopActivity({
  data,
  refreshToken = data,
  active,
  suspended,
  pending,
  onOpenReceipt,
  onDecision,
  onLoadCountDraft,
  returnFocusRef,
}: MaterialDesktopActivityProps): React.JSX.Element {
  const query = useMaterialDesktopActivity({
    active,
    suspended: suspended || pending,
    refreshToken,
  });
  const kind = query.input.kind;
  const asideVisible = useWorkspaceViewportAtLeast(1280);
  const [selected, setSelected] = React.useState<
    Partial<Record<MaterialDesktopActivityKind, string>>
  >({});
  const rows = React.useMemo(() => materialActivityRows(query.data), [query.data]);
  const columns = React.useMemo(() => materialActivityColumns(kind), [kind]);
  const explicit = rows.find((row) => row.item.id === selected[kind]);
  const context = explicit;
  const { listRef, detailRef } = useListDetailFocus({
    active,
    narrow: !asideVisible,
    selectionKey: context?.item.id ?? null,
  });
  const showingDetail = !query.loading && !query.error && Boolean(context);
  const hasFilters = Boolean(
    query.invalidInput ||
    query.input.search ||
    query.input.projectId ||
    query.input.locationId ||
    query.input.period !== "all" ||
    query.input.status !== "all",
  );
  const copy = kindCopy[kind];
  const resetFilters = (): void =>
    query.update({
      search: "",
      projectId: undefined,
      locationId: undefined,
      period: "all",
      status: "all",
      sort: "date",
      direction: "descending",
      page: 1,
      pageSize: 10,
    });
  const statusOptions =
    kind === "movements"
      ? [
          { value: "all", label: "Semua gerakan" },
          ...movementTypes.map((value) => ({ value, label: formatMovementType(value) })),
        ]
      : [
          { value: "all", label: "Semua status" },
          ...(kind === "receipts"
            ? ["POSTED", "REVERSAL_REQUESTED", "REVERSED"]
            : ["DRAFT", "PENDING_APPROVAL", "POSTED", "REJECTED"]
          ).map((value) => ({ value, label: formatMaterialStatus(value) })),
        ];
  const updatedTime = query.data
    ? new Date(query.data.updatedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      })
    : null;
  return (
    <section
      ref={returnFocusRef}
      tabIndex={-1}
      className="min-w-0 space-y-4"
      aria-label="Aktivitas material desktop"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={kind}
          onChange={query.changeKind}
          ariaLabel="Jenis aktivitas material"
          density="compact"
          scrollable
          options={[
            { value: "movements", label: "Gerakan stok" },
            { value: "receipts", label: "Penerimaan" },
            { value: "transfers", label: "Transfer" },
            { value: "counts", label: "Stock opname" },
          ]}
        />
        <Button
          size="mini"
          variant="secondary"
          disabled={pending || suspended || query.loading}
          onClick={query.reload}
        >
          <AppIcon name="refresh" className="icon-xs" />
          Segarkan
          {updatedTime ? (
            <span className="text-meta text-on-surface-variant">{updatedTime}</span>
          ) : null}
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          value={query.searchValue}
          onChange={(search) => query.update({ search })}
          placeholder={
            kind === "movements" ? "Cari material atau catatan…" : "Cari nomor atau material…"
          }
          ariaLabel={`Cari ${copy.title.toLocaleLowerCase("id-ID")}`}
          showClear={false}
          className="min-w-56 flex-1"
        />
        {kind === "movements" || kind === "receipts" ? (
          <FilterSelect
            label="Proyek aktivitas"
            value={query.input.projectId ?? ""}
            onChange={(projectId) => query.update({ projectId: projectId || undefined })}
            presentation="menu"
            searchable={data.projects.length > 8}
            options={[
              { value: "", label: "Semua proyek" },
              ...data.projects.map((project) => ({ value: project.id, label: project.name })),
            ]}
          />
        ) : null}
        <FilterSelect
          label="Lokasi aktivitas"
          value={query.input.locationId ?? ""}
          onChange={(locationId) => query.update({ locationId: locationId || undefined })}
          presentation="menu"
          searchable={data.locations.length > 8}
          options={[
            { value: "", label: "Semua lokasi" },
            ...data.locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
        />
        <FilterSelect
          label="Periode aktivitas"
          value={query.input.period}
          onChange={(period) => {
            if (period === "all" || period === "7" || period === "30") query.update({ period });
          }}
          presentation="menu"
          options={[
            { value: "all", label: "Semua waktu" },
            { value: "7", label: "7 hari terakhir" },
            { value: "30", label: "30 hari terakhir" },
          ]}
        />
        {kind !== "transfers" ? (
          <FilterSelect
            label={kind === "movements" ? "Jenis gerakan stok" : "Status dokumen material"}
            value={query.input.status}
            onChange={(status) => query.update({ status })}
            presentation="menu"
            options={statusOptions}
            searchable={kind === "movements"}
          />
        ) : null}
        {hasFilters ? (
          <Button
            size="mini"
            variant="secondary"
            disabled={pending || suspended}
            onClick={resetFilters}
          >
            Reset filter
          </Button>
        ) : null}
      </div>
      {query.error ? (
        <PageState
          kind="error"
          title="Aktivitas belum dapat dimuat"
          description={query.error}
          actionLabel={query.invalidInput ? "Reset filter" : "Coba lagi"}
          onAction={query.invalidInput ? resetFilters : query.reload}
        />
      ) : query.loading || !query.data ? (
        <MaterialDesktopSkeleton tab="activity" region="table" activityKind={kind} />
      ) : (
        <div
          className={`grid min-w-0 items-start gap-4 ${showingDetail ? "xl:grid-cols-[minmax(0,1fr)_288px]" : ""}`}
        >
          <div ref={listRef} className={`min-w-0 ${!asideVisible && context ? "hidden" : ""}`}>
            <DesktopTable
              ariaLabel={copy.title}
              columns={columns}
              rows={rows}
              rowKey={(row) => row.item.id}
              layout="fixed"
              selectedRowKey={asideVisible && context ? context.item.id : null}
              onRowSelectionChange={(row) => {
                if (!pending && !suspended)
                  setSelected((previous) => ({ ...previous, [kind]: row?.item.id }));
              }}
              emptyTitle={hasFilters ? "Tidak ada hasil" : copy.empty}
              emptyDescription={
                hasFilters ? "Sesuaikan filter atau kata pencarian." : copy.description
              }
              sortDescriptor={{ column: query.input.sort, direction: query.input.direction }}
              onSortChange={(descriptor) => {
                if (isActivitySort(descriptor.column))
                  query.update({ sort: descriptor.column, direction: descriptor.direction });
              }}
              footer={
                <DesktopTablePagination
                  total={query.data.total}
                  page={query.data.page}
                  pageSize={query.data.pageSize}
                  ariaLabel={`Halaman ${copy.title.toLocaleLowerCase("id-ID")}`}
                  onPageChange={(page) => query.update({ page })}
                  onPageSizeChange={(pageSize) => {
                    if (pageSize === 10 || pageSize === 25 || pageSize === 50)
                      query.update({ pageSize });
                  }}
                />
              }
            />
          </div>
          {context ? (
            <div ref={detailRef} className="min-w-0">
              <MaterialDesktopActivityDetail
                selection={context}
                capabilities={data.capabilities}
                pending={pending || suspended}
                onBack={() => setSelected((previous) => ({ ...previous, [kind]: undefined }))}
                onOpenReceipt={onOpenReceipt}
                onDecision={onDecision}
                onLoadCountDraft={onLoadCountDraft}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
