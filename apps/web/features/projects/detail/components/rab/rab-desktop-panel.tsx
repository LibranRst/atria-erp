"use client";

/* THESIS: inspect client selling rows and their membership before a guarded document decision.
 * OWN-WORLD: Atria Manrope, cool canvas, divided white panels, native HeroUI tables and ink capsules.
 * STORY: compare the current RAB with its approved baseline, inspect exact client fields, then edit or export.
 * FIRST VIEWPORT: compact identity/actions, one fact band, inline filters and a five-column table; independent context at1280px.
 * FORM: established Projects desktop extension; source order remains authoritative outside table browsing.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */

import React from "react";
import {
  AppIcon,
  Button,
  DesktopTable,
  DesktopTablePagination,
  FactRow,
  FilterSelect,
  GroupedSurface,
  MoneyValue,
  SearchInput,
  StatusBadge,
  desktopTablePage,
  useListDetailFocus,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type {
  RabBundleView,
  RabEstimateView,
  RabRevisionHistoryView,
  RapView,
} from "../../types/rap-rab-types";
import {
  buildRabDesktopRows,
  filterRabDesktopRows,
  rabDesktopContext,
  rabDesktopRowType,
  type RabDesktopKind,
  type RabDesktopRow,
  type RabDesktopVisibility,
} from "./rab-desktop-model";
import { useRabDesktopQuery } from "./use-rab-desktop-query";

export function RabDesktopAmount({
  amount,
  exact = false,
  size = "sm",
  align = "right",
}: {
  readonly amount: number;
  readonly exact?: boolean;
  readonly size?: "sm" | "lg";
  readonly align?: "left" | "right";
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      variant={exact ? "fullDynamic" : "compact"}
      size={size}
      align={align}
    />
  );
}

function rowVisibility(row: RabDesktopRow): React.JSX.Element {
  return (
    <StatusBadge
      label={row.clientVisible ? "Tampil" : "Disembunyikan"}
      tone={row.clientVisible ? "healthy" : "neutral"}
    />
  );
}

export const rabDesktopColumns: readonly DesktopTableColumn<RabDesktopRow>[] = [
  {
    key: "item",
    label: "Baris RAB",
    widthPercent: 32,
    sortValue: (row) => row.record.clientLabel,
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="font-semibold wrap-anywhere">{row.record.clientLabel}</p>
        <p className="text-meta text-on-surface-variant">{rabDesktopRowType(row)}</p>
      </div>
    ),
  },
  {
    key: "quantity",
    label: "Jumlah",
    widthPercent: 13,
    align: "end",
    sortValue: (row) => Number(row.record.quantity),
    render: (row) => (
      <span className="wrap-anywhere tabular-nums">
        {Number(row.record.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })}{" "}
        {row.record.unit}
      </span>
    ),
  },
  {
    key: "price",
    label: "Harga jual",
    widthPercent: 17,
    align: "end",
    sortValue: (row) => Number(row.record.unitPrice),
    render: (row) => <RabDesktopAmount amount={Number(row.record.unitPrice)} />,
  },
  {
    key: "total",
    label: "Subtotal",
    widthPercent: 17,
    align: "end",
    sortValue: (row) => Number(row.record.lineTotal),
    render: (row) => <RabDesktopAmount amount={Number(row.record.lineTotal)} />,
  },
  {
    key: "visibility",
    label: "Tampilan",
    widthPercent: 21,
    sortValue: (row) => Number(!row.clientVisible),
    render: rowVisibility,
  },
];

function kindValue(raw: string): RabDesktopKind {
  return raw === "bundle" ||
    raw === "material" ||
    raw === "package" ||
    raw === "manual" ||
    raw === "service" ||
    raw === "members"
    ? raw
    : "all";
}
function visibilityValue(raw: string): RabDesktopVisibility {
  return raw === "visible" || raw === "hidden" ? raw : "all";
}

function RabRowContext({
  row,
  estimate,
  canManage,
  pending,
  onEditBundle,
  onEditItem,
}: {
  readonly row: RabDesktopRow;
  readonly estimate: RabEstimateView;
  readonly canManage: boolean;
  readonly pending: boolean;
  readonly onEditBundle: (bundle: RabBundleView) => void;
  readonly onEditItem: (id: string | null) => void;
}): React.JSX.Element {
  const editable = canManage && estimate.status === "DRAFT";
  const members =
    row.kind === "bundle" ? estimate.items.filter((item) => item.bundleId === row.record.id) : [];
  const parent =
    row.kind === "item" && row.record.bundleId
      ? estimate.bundles.find((bundle) => bundle.id === row.record.bundleId)
      : undefined;
  return (
    <div className="min-w-0 space-y-3">
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-semibold wrap-anywhere">
              {row.record.clientLabel}
            </h3>
            {rowVisibility(row)}
          </div>
          <p className="text-support text-on-surface-variant">{rabDesktopRowType(row)}</p>
          {editable && (
            <Button
              type="button"
              variant="primary"
              size="compact"
              fullWidth
              leadingIcon={<AppIcon name="edit" />}
              disabled={pending}
              onClick={() => {
                if (pending) return;
                if (row.kind === "bundle") onEditBundle(row.record);
                else onEditItem(row.record.id);
              }}
            >
              {row.kind === "bundle" ? "Edit paket" : "Edit item"}
            </Button>
          )}
          {row.record.description ? (
            <p className="text-support leading-relaxed wrap-anywhere text-on-surface-variant">
              {row.record.description}
            </p>
          ) : null}
        </div>
        <div className="divide-y divide-outline-variant/25 border-t border-outline-variant/25">
          <FactRow
            label="Jumlah"
            value={`${Number(row.record.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })} ${row.record.unit}`}
            wrapLabel
          />
          <FactRow
            label="Harga jual satuan"
            value={<RabDesktopAmount amount={Number(row.record.unitPrice)} exact />}
            layout="stacked"
          />
          <FactRow
            label="Subtotal"
            value={<RabDesktopAmount amount={Number(row.record.lineTotal)} exact />}
            layout="stacked"
          />
          {row.kind === "item" && row.record.sourceRevision !== null ? (
            <FactRow label="Revisi sumber" value={`R${row.record.sourceRevision}`} />
          ) : null}
        </div>
        {parent ? (
          <div className="space-y-1 border-t border-outline-variant/25 p-4 text-support">
            <p className="font-semibold">Termasuk {parent.clientLabel}</p>
            <p className="text-on-surface-variant">
              Subtotal anggota tidak ditambahkan lagi ke nilai RAB.
              {parent.isHidden ? " Paket ini disembunyikan dari dokumen klien." : ""}
            </p>
          </div>
        ) : null}
        {!editable && (
          <p className="border-t border-outline-variant/25 p-4 text-support text-on-surface-variant">
            {estimate.status === "APPROVED"
              ? "Baseline disetujui. Perubahan melalui revisi RAB."
              : "Rincian sesuai akses Anda."}
          </p>
        )}
      </GroupedSurface>
      {row.kind === "bundle" ? (
        <GroupedSurface variant="desktopPanel">
          <h3 className="px-4 pt-4 text-support font-semibold">Anggota paket · {members.length}</h3>
          <div className="divide-y divide-outline-variant/25">
            {members.map((member) => (
              <div key={member.id} className="space-y-1 p-4">
                <p className="text-support font-semibold wrap-anywhere">{member.clientLabel}</p>
                <p className="text-meta text-on-surface-variant">
                  {Number(member.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })}{" "}
                  {member.unit}
                  {member.isHidden
                    ? " · Disembunyikan"
                    : row.record.isHidden
                      ? " · Paket disembunyikan"
                      : ""}
                </p>
                <Button
                  type="button"
                  variant="quiet"
                  size="compact"
                  disabled={pending}
                  onClick={() => {
                    if (!pending) onEditItem(member.id);
                  }}
                >
                  Rincian item
                </Button>
              </div>
            ))}
            {members.length === 0 ? (
              <p className="p-4 text-support text-on-surface-variant">Belum ada anggota paket.</p>
            ) : null}
          </div>
          <p className="border-t border-outline-variant/25 p-4 text-meta text-on-surface-variant">
            Nilai RAB memakai harga paket, tanpa menjumlahkan ulang anggotanya.
          </p>
        </GroupedSurface>
      ) : null}
    </div>
  );
}

export function RabDesktopPanel({
  rabEstimate,
  isRevisionDraft,
  approvedBaseline,
  visibleRabValue,
  staleSourceLabels,
  isPending,
  handleRefreshRabSources,
  canManageRab,
  canCreateRab,
  rap,
  setSourcePickerOpen,
  setManualLineOpen,
  openEditBundle,
  setRabItemEditorId,
  openCreateBundle,
  onOpenExport,
}: {
  readonly rabEstimate: RabEstimateView;
  readonly isRevisionDraft: boolean;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly visibleRabValue: number;
  readonly staleSourceLabels: readonly string[];
  readonly isPending: boolean;
  readonly handleRefreshRabSources: () => void;
  readonly canManageRab: boolean;
  readonly canCreateRab: boolean;
  readonly rap: RapView | null;
  readonly setSourcePickerOpen: (open: boolean) => void;
  readonly setManualLineOpen: (open: boolean) => void;
  readonly openEditBundle: (bundle: RabBundleView) => void;
  readonly setRabItemEditorId: (id: string | null) => void;
  readonly openCreateBundle: () => void;
  readonly onOpenExport: () => void;
}): React.JSX.Element {
  const { input, update } = useRabDesktopQuery("rab-lines");
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const desktop = useWorkspacePresentation() === "desktop";
  const aside = useWorkspaceViewportAtLeast(1280);
  const rows = React.useMemo(() => buildRabDesktopRows(rabEstimate), [rabEstimate]);
  const roots = rows.filter((row) => row.kind === "bundle" || !row.record.bundleId);
  const filtered = filterRabDesktopRows(rows, {
    search: input.search,
    kind: kindValue(input.kind),
    visibility: visibilityValue(input.visibility),
  });
  const sort = {
    column: rabDesktopColumns.some((column) => column.key === input.sort) ? input.sort : "order",
    direction: input.direction,
  };
  const table = desktopTablePage(
    filtered,
    rabDesktopColumns,
    (row) => row.key,
    sort,
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((row) => row.key === selectedKey);
  const context = rabDesktopContext(table.rows, selectedKey);
  const { listRef, detailRef } = useListDetailFocus({
    active: desktop,
    narrow: !aside,
    selectionKey: context?.key ?? null,
  });
  const draft = rabEstimate.status === "DRAFT";
  const bundleEligible =
    canManageRab &&
    draft &&
    rabEstimate.items.filter((item) => !item.bundleId && !item.isHidden).length >= 2;
  const hasFilters =
    input.search !== "" ||
    input.kind !== "all" ||
    input.visibility !== "all" ||
    input.sort !== "order";
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {isRevisionDraft ? `Revisi RAB R${rabEstimate.revision}` : "RAB klien"}
            </h2>
            <StatusBadge
              label={formatBusinessLabel(rabEstimate.status)}
              tone={rabEstimate.status === "APPROVED" ? "healthy" : "neutral"}
            />
          </div>
          <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
            {rabEstimate.title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateRab && rabEstimate.status === "APPROVED" && rap ? (
            <Button
              size="compact"
              variant="secondary"
              disabled={isPending}
              onClick={() => setSourcePickerOpen(true)}
            >
              Buat revisi
            </Button>
          ) : null}
          {rabEstimate.status !== "VOID" ? (
            <Button variant="secondary" size="compact" disabled={isPending} onClick={onOpenExport}>
              <AppIcon name="description" className="icon-sm" />
              Ekspor dokumen
            </Button>
          ) : null}
        </div>
      </div>
      <GroupedSurface variant="desktopPanel">
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/25 p-4">
          <div className="min-w-0 pr-4">
            <dt className="text-support text-on-surface-variant">Nilai RAB klien</dt>
            <dd className="mt-2">
              <RabDesktopAmount amount={visibleRabValue} size="lg" align="left" />
            </dd>
          </div>
          <div className="min-w-0 px-4">
            <dt className="text-support text-on-surface-variant">Baseline disetujui</dt>
            <dd className="mt-2">
              {approvedBaseline ? (
                <RabDesktopAmount amount={approvedBaseline.value} size="lg" align="left" />
              ) : (
                <span className="text-support text-on-surface-variant">Belum disetujui</span>
              )}
            </dd>
          </div>
          <div className="min-w-0 px-4">
            <dt className="text-support text-on-surface-variant">Baris tampil</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {roots.filter((row) => !row.record.isHidden).length}
            </dd>
          </div>
          <div className="min-w-0 pl-4">
            <dt className="text-support text-on-surface-variant">Dalam paket</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {rows.length - roots.length}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-outline-variant/25 px-4 py-3 text-support text-on-surface-variant">
          <p>
            R{rabEstimate.revision} · {roots.filter((row) => row.record.isHidden).length} baris
            disembunyikan
          </p>
          {isRevisionDraft && approvedBaseline ? (
            <div className="flex items-center gap-2">
              <span>Selisih dari R{approvedBaseline.revision}</span>
              <RabDesktopAmount amount={visibleRabValue - approvedBaseline.value} exact />
            </div>
          ) : (
            <p>Harga jual dan catatan yang ditujukan untuk klien.</p>
          )}
        </div>
      </GroupedSurface>
      {draft && staleSourceLabels.length > 0 ? (
        <GroupedSurface variant="desktopPanel">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-2">
              <AppIcon name="warning" className="mt-0.5 icon-sm shrink-0 text-warning" />
              <div className="min-w-0 space-y-1">
                <p className="text-support font-semibold">
                  {staleSourceLabels.length} sumber berubah
                </p>
                <p className="max-w-prose text-support text-on-surface-variant">
                  {staleSourceLabels.join(" · ")}
                </p>
                <p className="text-meta text-on-surface-variant">
                  Jumlah dan harga perlu ditinjau; label klien tetap dipertahankan.
                </p>
              </div>
            </div>
            {canManageRab ? (
              <Button
                size="compact"
                variant="secondary"
                pending={isPending}
                onClick={handleRefreshRabSources}
              >
                Perbarui sumber
              </Button>
            ) : null}
          </div>
        </GroupedSurface>
      ) : null}
      <section id="rab-desktop-items" aria-label="Isi RAB" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-base font-semibold">Isi RAB</h2>
            <p className="mt-1 text-meta text-on-surface-variant">
              Urutan tersimpan. Pengurutan tabel tidak mengubah dokumen.
            </p>
          </div>
          {canManageRab && draft ? (
            <div className="flex flex-wrap gap-2">
              {bundleEligible ? (
                <Button
                  variant="secondary"
                  size="compact"
                  disabled={isPending}
                  onClick={openCreateBundle}
                >
                  Buat paket
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="compact"
                disabled={isPending}
                onClick={() => setManualLineOpen(true)}
              >
                <AppIcon name="add" className="icon-sm" />
                Item manual
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1">
            <SearchInput
              value={input.search}
              onChange={(search) => {
                setSelectedKey(null);
                update({ search });
              }}
              placeholder="Cari item, paket, atau uraian..."
              ariaLabel="Cari isi RAB"
            />
          </div>
          <FilterSelect
            label="Jenis baris"
            value={kindValue(input.kind)}
            onChange={(kind) => {
              setSelectedKey(null);
              update({ kind });
            }}
            presentation="menu"
            options={[
              { value: "all", label: "Semua baris dokumen" },
              { value: "bundle", label: "Paket RAB" },
              { value: "material", label: "Material" },
              { value: "package", label: "Paket kerja" },
              { value: "manual", label: "Manual" },
              { value: "service", label: "Jasa & fee" },
              { value: "members", label: "Item dalam paket" },
            ]}
          />
          <FilterSelect
            label="Tampilan dokumen"
            value={visibilityValue(input.visibility)}
            onChange={(visibility) => {
              setSelectedKey(null);
              update({ visibility });
            }}
            presentation="menu"
            options={[
              { value: "all", label: "Semua tampilan" },
              { value: "visible", label: "Tampil" },
              { value: "hidden", label: "Disembunyikan" },
            ]}
          />
          {hasFilters ? (
            <Button
              variant="ghost"
              size="compact"
              onClick={() => {
                setSelectedKey(null);
                update({
                  search: "",
                  kind: "all",
                  visibility: "all",
                  sort: "order",
                  direction: "ascending",
                });
              }}
            >
              Reset tampilan
            </Button>
          ) : null}
        </div>
        {input.kind === "members" ? (
          <p className="px-1 text-support text-on-surface-variant">
            Anggota paket untuk pemeriksaan. Nilai dokumen memakai subtotal paketnya.
          </p>
        ) : null}
        <div
          className={`grid min-w-0 items-start gap-4 ${context ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
        >
          <div ref={listRef} className={`min-w-0 ${explicit ? "hidden xl:block" : ""}`}>
            <DesktopTable
              ariaLabel="Item dan paket RAB klien"
              rows={table.rows}
              columns={rabDesktopColumns}
              rowKey={(row) => row.key}
              layout="fixed"
              sortDescriptor={sort}
              onSortChange={(next) => {
                setSelectedKey(null);
                update({ sort: String(next.column), direction: next.direction });
              }}
              selectedRowKey={aside ? (context?.key ?? null) : null}
              onRowSelectionChange={(row) => {
                if (!isPending) setSelectedKey(row?.key ?? null);
              }}
              emptyTitle={rows.length === 0 ? "Belum ada isi RAB" : "Tidak ada hasil"}
              emptyDescription={
                rows.length === 0
                  ? "Tambahkan item manual atau pilih sumber RAB."
                  : "Sesuaikan pencarian atau filter baris."
              }
              footer={
                <DesktopTablePagination
                  page={table.page}
                  pageSize={input.pageSize}
                  total={table.total}
                  onPageChange={(page) => {
                    setSelectedKey(null);
                    update({ page });
                  }}
                  onPageSizeChange={(pageSize) => {
                    setSelectedKey(null);
                    update({ pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10 });
                  }}
                  ariaLabel="Halaman isi RAB"
                />
              }
            />
          </div>
          {context ? (
            <section
              ref={detailRef}
              className={`min-w-0 space-y-3 ${explicit ? "" : "hidden xl:block"}`}
              aria-label="Rincian baris RAB"
            >
              {explicit ? (
                <Button
                  size="mini"
                  variant="secondary"
                  className="xl:hidden"
                  disabled={isPending}
                  onClick={() => setSelectedKey(null)}
                >
                  <AppIcon name="arrow_back" className="icon-xs" />
                  Kembali ke daftar
                </Button>
              ) : null}
              <RabRowContext
                row={context}
                estimate={rabEstimate}
                canManage={canManageRab}
                pending={isPending}
                onEditBundle={openEditBundle}
                onEditItem={setRabItemEditorId}
              />
            </section>
          ) : null}
        </div>
      </section>
      {rabEstimate.clientNotes ? (
        <GroupedSurface variant="desktopPanel">
          <div className="space-y-2 p-4">
            <h3 className="text-support font-semibold">Catatan untuk klien</h3>
            <p className="max-w-prose text-support leading-relaxed wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
              {rabEstimate.clientNotes}
            </p>
          </div>
        </GroupedSurface>
      ) : null}
    </div>
  );
}
