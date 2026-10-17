"use client";

import React from "react";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
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
  SectionHeader,
  StatusBadge,
  desktopTablePage,
  useListDetailFocus,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { RapOverviewFilter } from "../../types/rap-rab-types";
import {
  filterRapDesktopRows,
  formatRapQuantity,
  rapSourceLabel,
  type RapDesktopRow,
} from "./rap-desktop-model";
import { useRapDesktopQuery } from "./use-rap-desktop-query";

export function RapAmount({
  amount,
  exact = false,
}: {
  readonly amount: number;
  readonly exact?: boolean;
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      variant={exact ? "fullDynamic" : "compact"}
      size="sm"
      align="right"
    />
  );
}

function RowStatus({ row }: { readonly row: RapDesktopRow }): React.JSX.Element {
  return row.material ? (
    <StatusBadge
      label={row.material.needToBuy > 0 ? "Perlu beli" : "Tertutup stok"}
      tone={row.material.needToBuy > 0 ? "warning" : "neutral"}
    />
  ) : (
    <StatusBadge
      label={row.status === "ACTIVE" ? "Siap" : formatBusinessLabel(row.status)}
      tone={row.status === "DRAFT" ? "warning" : "neutral"}
    />
  );
}

export const rapDesktopColumns: readonly DesktopTableColumn<RapDesktopRow>[] = [
  {
    key: "name",
    label: "Item / lingkup",
    widthPercent: 31,
    sortValue: (row) => row.name,
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold wrap-break-word">{row.name}</p>
        <p className="text-support wrap-break-word text-on-surface-variant">
          {row.area || "Area belum ditentukan"}
          {row.package?.vendorName ? ` · ${row.package.vendorName}` : ""}
        </p>
      </div>
    ),
  },
  {
    key: "quantity",
    label: "Kebutuhan",
    widthPercent: 15,
    align: "end",
    sortValue: (row) => Number(row.quantity),
    render: (row) => (
      <span className="text-sm tabular-nums">
        {formatRapQuantity(row.quantity)} {row.unit}
      </span>
    ),
  },
  {
    key: "estimate",
    label: "Estimasi",
    widthPercent: 18,
    align: "end",
    sortValue: (row) => row.estimate,
    render: (row) => <RapAmount amount={row.estimate} />,
  },
  {
    key: "actual",
    label: "Realisasi",
    widthPercent: 18,
    align: "end",
    sortValue: (row) => row.actual,
    render: (row) => <RapAmount amount={row.actual} />,
  },
  {
    key: "status",
    label: "Kondisi",
    widthPercent: 18,
    sortValue: (row) => (row.material ? row.material.needToBuy : row.status),
    render: (row) => <RowStatus row={row} />,
  },
];

/** Planning compares source unit prices; execution keeps its actual-cost column. */
export const rapPlanningColumns: readonly DesktopTableColumn<RapDesktopRow>[] =
  rapDesktopColumns.flatMap((column): readonly DesktopTableColumn<RapDesktopRow>[] => {
    if (column.key === "actual") return [];
    if (column.key === "estimate")
      return [
        {
          key: "unitCost",
          label: "Harga satuan",
          widthPercent: column.widthPercent,
          align: "end",
          sortValue: (row) =>
            Number(row.material?.estimatedUnitCost ?? row.package?.estimatedUnitCost),
          render: (row) => (
            <RapAmount
              amount={Number(row.material?.estimatedUnitCost ?? row.package?.estimatedUnitCost)}
            />
          ),
        },
        { ...column, label: "Estimasi total" },
      ];
    return [column];
  });

function RapRowContext({
  row,
  onOpen,
  onEdit,
  pending,
}: {
  readonly row: RapDesktopRow;
  readonly onOpen: (row: RapDesktopRow) => void;
  readonly onEdit?: (row: RapDesktopRow) => void;
  readonly pending: boolean;
}): React.JSX.Element {
  const material = row.material;
  const item = row.package;
  return (
    <section className="min-w-0 space-y-3" aria-label="Rincian item RAP">
      <SectionHeader title="Rincian item" />
      <GroupedSurface variant="desktopPanel" className="overflow-hidden">
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-semibold wrap-break-word">{row.name}</h3>
          <p className="text-support wrap-break-word text-on-surface-variant">
            {row.area || "Area belum ditentukan"}
          </p>
          <RowStatus row={row} />
          {onEdit && (material || row.status === "DRAFT") && (
            <Button
              type="button"
              size="compact"
              variant="primary"
              leadingIcon={<AppIcon name="edit" />}
              fullWidth
              disabled={pending}
              onClick={(): void => onEdit(row)}
            >
              Edit {material ? "material" : "paket"}
            </Button>
          )}
        </div>
        <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          <FactRow label="Estimasi biaya" value={<RapAmount amount={row.estimate} exact />} />
          <FactRow label="Realisasi" value={<RapAmount amount={row.actual} exact />} />
          <FactRow label="Kebutuhan" value={`${formatRapQuantity(row.quantity)} ${row.unit}`} />
          <FactRow
            label="Harga satuan"
            value={
              <RapAmount
                amount={Number(material?.estimatedUnitCost ?? item?.estimatedUnitCost)}
                exact
              />
            }
          />
          <FactRow
            label="Status rencana"
            value={row.status === "ACTIVE" ? "Siap" : formatBusinessLabel(row.status)}
          />
          {material ? (
            <>
              <FactRow
                label="Jumlah utama"
                value={`${formatRapQuantity(material.requiredQuantity)} ${row.unit}`}
              />
              <FactRow
                label="Buffer"
                value={`${formatRapQuantity(material.bufferQuantity)} ${row.unit}`}
              />
              <FactRow label="Sumber" value={rapSourceLabel(material.source)} />
              <FactRow
                label="Stok tersedia"
                value={`${formatRapQuantity(material.availableStock)} ${row.unit}`}
              />
              <FactRow
                label="Perlu beli"
                value={`${formatRapQuantity(material.needToBuy)} ${row.unit}`}
              />
              <FactRow
                label="Direservasi"
                value={`${formatRapQuantity(material.reservedQuantity)} ${row.unit}`}
              />
              <FactRow
                label="Terpakai"
                value={`${formatRapQuantity(material.usedQuantity)} ${row.unit}`}
              />
            </>
          ) : (
            <FactRow label="Vendor" value={item?.vendorName ?? "Belum ditentukan"} />
          )}
        </div>
        {(material?.description || item?.scopeDescription) && (
          <p className="border-t border-outline-variant/20 p-4 text-support leading-relaxed wrap-break-word text-on-surface-variant">
            {material?.description ?? item?.scopeDescription}
          </p>
        )}
        {material && (
          <p className="border-t border-outline-variant/20 px-4 pt-3 text-support leading-relaxed text-on-surface-variant">
            Stok tersedia belum otomatis dialokasikan ke item ini. RAP tidak mencatat pembayaran
            atau gerakan stok.
          </p>
        )}
        <div className="p-4">
          <Button
            type="button"
            size="compact"
            variant="secondary"
            fullWidth
            onClick={(): void => onOpen(row)}
          >
            Buka detail {material ? "material" : "paket"}
          </Button>
        </div>
      </GroupedSurface>
    </section>
  );
}

export function RapDesktopTable({
  kind,
  rows,
  skipped = false,
  active,
  onOpen,
  action,
  planning = false,
  onEdit,
  pending = false,
}: {
  readonly kind: RapOverviewFilter;
  readonly rows: readonly RapDesktopRow[];
  readonly skipped?: boolean;
  readonly active: boolean;
  readonly onOpen: (row: RapDesktopRow) => void;
  readonly action?: React.ReactNode;
  readonly planning?: boolean;
  readonly onEdit?: (row: RapDesktopRow) => void;
  readonly pending?: boolean;
}): React.JSX.Element {
  const { input, update } = useRapDesktopQuery(kind);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const desktop = useWorkspacePresentation() === "desktop";
  const wide = useWorkspaceViewportAtLeast(1280);
  const columns = planning ? rapPlanningColumns : rapDesktopColumns;
  const sortColumn = columns.some((column) => column.key === input.sort) ? input.sort : "name";
  const filtered = filterRapDesktopRows(rows, input.search, input.condition);
  const table = desktopTablePage(
    filtered,
    columns,
    (row) => row.id,
    { column: sortColumn, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((row) => row.id === selectedId);
  const context = explicit;
  const { listRef, detailRef } = useListDetailFocus({
    active: active && desktop,
    narrow: !wide,
    selectionKey: context?.id ?? null,
  });
  const title =
    kind === "MATERIAL" ? "Material RAP" : kind === "TUKANG" ? "Paket Tukang" : "Paket Subcon";
  return (
    <section hidden={!active} inert={!active} className="min-w-0 space-y-3" aria-label={title}>
      <SectionHeader
        title={title}
        count={rows.length}
        countLabel={kind === "MATERIAL" ? "material" : "paket"}
        action={action}
      />
      {planning && kind === "MATERIAL" && !skipped && (
        <p className="px-1 text-support text-on-surface-variant">
          Kebutuhan mencakup jumlah utama dan buffer; harga mengikuti satuan setiap material.
        </p>
      )}
      {skipped ? (
        <GroupedSurface variant="desktopPanel" className="p-4">
          <p className="text-sm font-semibold">
            Lingkup {kind === "TUKANG" ? "Tukang" : "Subcon"} tidak digunakan
          </p>
          <p className="mt-1 text-support text-on-surface-variant">
            Keputusan lingkup tersimpan dan akan ikut ditinjau saat finalisasi.
          </p>
        </GroupedSurface>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchInput
              value={input.search}
              onChange={(search): void => update({ search })}
              ariaLabel={`Cari ${title.toLowerCase()}`}
              placeholder={
                kind === "MATERIAL"
                  ? "Cari material atau area..."
                  : "Cari paket, area, atau vendor..."
              }
              className="min-w-48 flex-1"
            />
            <FilterSelect
              label={`Kondisi ${title}`}
              presentation="menu"
              value={input.condition}
              onChange={(condition): void => update({ condition })}
              options={
                kind === "MATERIAL"
                  ? [
                      { value: "all", label: "Semua kondisi" },
                      { value: "need", label: "Perlu beli" },
                      { value: "covered", label: "Tertutup stok" },
                    ]
                  : [
                      { value: "all", label: "Semua status" },
                      { value: "draft", label: "Draf" },
                      { value: "ready", label: "Siap" },
                    ]
              }
            />
          </div>
          <div
            className={`grid min-w-0 items-start gap-4 ${wide && context ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1"}`}
          >
            <div ref={listRef} hidden={!wide && Boolean(explicit)} className="min-w-0">
              <DesktopTable
                ariaLabel={title}
                layout="fixed"
                columns={columns}
                rows={table.rows}
                rowKey={(row) => row.id}
                selectedRowKey={wide ? (context?.id ?? null) : null}
                onRowSelectionChange={(row): void => setSelectedId(row?.id ?? null)}
                sortDescriptor={{ column: sortColumn, direction: input.direction }}
                onSortChange={(sort): void =>
                  update({ sort: String(sort.column), direction: sort.direction })
                }
                emptyTitle={
                  rows.length === 0
                    ? `Belum ada ${kind === "MATERIAL" ? "material" : "paket"}`
                    : "Tidak ada hasil"
                }
                emptyDescription={
                  rows.length === 0
                    ? "Tambahkan item untuk menyusun rencana biaya internal."
                    : "Sesuaikan pencarian atau kondisi."
                }
                footer={
                  <DesktopTablePagination
                    page={table.page}
                    pageSize={input.pageSize}
                    total={table.total}
                    onPageChange={(page): void => update({ page })}
                    onPageSizeChange={(pageSize): void =>
                      update({ pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10 })
                    }
                  />
                }
              />
            </div>
            {context && (
              <div ref={detailRef} className="min-w-0 space-y-3">
                {!wide && (
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
                <RapRowContext row={context} onOpen={onOpen} onEdit={onEdit} pending={pending} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
