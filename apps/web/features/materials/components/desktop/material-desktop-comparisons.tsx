"use client";

import React from "react";
import { useCan } from "@/components/auth/permissions-provider";
import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  AppIcon,
  Button,
  ButtonLink,
  DesktopTable,
  DesktopTablePagination,
  FactRow,
  FilterSelect,
  GroupedSurface,
  MoneyValue,
  PageState,
  SearchInput,
  StatusBadge,
  desktopTablePage,
  useListDetailFocus,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useMaterialDesktopQuery } from "../../hooks/use-material-desktop-query";
import {
  formatMaterialQuantity,
  formatMaterialStatus,
  type GroupedMaterial,
} from "../../utils/material-ui-utils";
import {
  materialNeedComparisons,
  materialStockComparisons,
  type NeedComparison,
  type StockComparison,
} from "./material-desktop-model";

function stockKey(row: StockComparison): string {
  return row.id;
}
function needKey(row: NeedComparison): string {
  return row.id;
}
function Quantity({
  value,
  unit,
}: {
  readonly value: number;
  readonly unit: string | null;
}): React.JSX.Element {
  return (
    <span className="tabular-nums">
      {formatMaterialQuantity(value)}
      {unit ? (
        <>
          {" "}
          <span className="text-meta font-normal text-on-surface-variant">{unit}</span>
        </>
      ) : (
        <span className="sr-only">, satuan belum tersedia</span>
      )}
    </span>
  );
}
function StockStatus({ row }: { readonly row: StockComparison }): React.JSX.Element {
  const affectedLocations = row.material.rows.filter(
    (item) => item.status === row.summary.status,
  ).length;
  const qualified = row.summary.locationCount > 1 && row.summary.status !== "AVAILABLE";
  return (
    <div className="space-y-1">
      <StatusBadge
        label={formatMaterialStatus(row.summary.status)}
        tone={
          row.summary.status === "OUT_OF_STOCK"
            ? "critical"
            : row.summary.status === "LOW_STOCK" || row.summary.status === "RESERVED"
              ? "warning"
              : "neutral"
        }
      />
      {qualified ? (
        <p className="text-meta text-on-surface-variant">
          {affectedLocations} dari {row.summary.locationCount} lokasi
        </p>
      ) : null}
    </div>
  );
}
function NeedStatus({ row }: { readonly row: NeedComparison }): React.JSX.Element {
  return (
    <StatusBadge
      label={
        row.status === "DRAFT"
          ? "Draft"
          : row.status === "PLANNED"
            ? "Rencana"
            : row.needToBuy > 0
              ? "Belum tertutup"
              : "Terpenuhi"
      }
      tone={row.needToBuy > 0 ? "warning" : "neutral"}
    />
  );
}
export const stockComparisonColumns: readonly DesktopTableColumn<StockComparison>[] = [
  {
    key: "name",
    label: "Material",
    widthPercent: 29,
    sortValue: (r) => r.material.name,
    render: (r) => (
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 font-semibold">{r.material.name}</p>
        <p
          className="truncate text-support text-on-surface-variant"
          title={r.material.categoryName}
        >
          {r.material.categoryName} · {r.summary.locationCount} lokasi
        </p>
      </div>
    ),
  },
  {
    key: "current",
    label: "Fisik",
    widthPercent: 12,
    align: "end",
    sortValue: (r) => r.summary.currentStock,
    render: (r) => <Quantity value={r.summary.currentStock} unit={r.unit} />,
  },
  {
    key: "reserved",
    label: "Terikat",
    widthPercent: 12,
    align: "end",
    sortValue: (r) => r.summary.reservedStock,
    render: (r) => <Quantity value={r.summary.reservedStock} unit={r.unit} />,
  },
  {
    key: "available",
    label: "Tersedia",
    widthPercent: 15,
    align: "end",
    sortValue: (r) => r.summary.availableStock,
    render: (r) => (
      <div className="space-y-1">
        <Quantity value={r.summary.availableStock} unit={r.unit} />
        <p className="text-meta text-on-surface-variant">
          Min. {formatMaterialQuantity(r.summary.minimumStock)} {r.unit}
        </p>
      </div>
    ),
  },
  {
    key: "value",
    label: "Nilai stok",
    widthPercent: 15,
    align: "end",
    sortValue: (r) => r.summary.stockValue,
    render: (r) => (
      <MoneyValue
        amount={r.summary.stockValue}
        fractionDigits={Number.isInteger(r.summary.stockValue) ? 0 : 2}
        variant="compact"
        size="sm"
      />
    ),
  },
  {
    key: "status",
    label: "Kondisi",
    widthPercent: 17,
    sortValue: (r) => r.summary.status,
    render: (r) => <StockStatus row={r} />,
  },
];
const needColumns: readonly DesktopTableColumn<NeedComparison>[] = [
  {
    key: "name",
    label: "Material / area",
    widthPercent: 25,
    sortValue: (r) => r.materialName,
    render: (r) => (
      <div className="space-y-1">
        <p className="line-clamp-2 font-semibold">{r.materialName}</p>
        <p className="truncate text-support text-on-surface-variant" title={r.area}>
          {r.area || "Area belum dicatat"}
          {!r.materialId ? " · Belum tertaut" : ""}
        </p>
      </div>
    ),
  },
  {
    key: "project",
    label: "Proyek",
    widthPercent: 15,
    sortValue: (r) => r.projectName,
    render: (r) => (
      <span className="block truncate text-support" title={r.projectName}>
        {r.projectName}
      </span>
    ),
  },
  {
    key: "required",
    label: "Kebutuhan",
    widthPercent: 13,
    align: "end",
    sortValue: (r) => r.totalQuantity,
    render: (r) => <Quantity value={r.totalQuantity} unit={r.unit} />,
  },
  {
    key: "shortage",
    label: "Belum tertutup",
    widthPercent: 15,
    align: "end",
    sortValue: (r) => r.needToBuy,
    render: (r) => <Quantity value={r.needToBuy} unit={r.unit} />,
  },
  {
    key: "value",
    label: "Estimasi RAP",
    widthPercent: 14,
    align: "end",
    sortValue: (r) => r.estimatedTotalCost,
    render: (r) => (
      <MoneyValue
        amount={r.estimatedTotalCost}
        fractionDigits={Number.isInteger(r.estimatedTotalCost) ? 0 : 2}
        variant="compact"
        size="sm"
      />
    ),
  },
  {
    key: "status",
    label: "Status",
    widthPercent: 18,
    sortValue: (r) => r.status,
    render: (r) => <NeedStatus row={r} />,
  },
];

function StockDetail({
  row,
  onOpenMaterial,
}: {
  readonly row: StockComparison;
  readonly onOpenMaterial: (id: string) => void;
}): React.JSX.Element {
  const primary = row.material.rows[0];
  return (
    <div className="@container min-w-0 space-y-4">
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-section font-bold">Posisi material</h2>
            <StockStatus row={row} />
          </div>
          <p className="text-row font-semibold wrap-anywhere">{row.material.name}</p>
          <p className="text-support text-on-surface-variant">{row.material.categoryName}</p>
          <MoneyValue
            amount={row.summary.stockValue}
            fractionDigits={Number.isInteger(row.summary.stockValue) ? 0 : 2}
            variant="fullDynamic"
            size="lg"
          />
        </div>
        <dl className="grid grid-cols-3 divide-x divide-outline-variant/30 border-y border-outline-variant/30 bg-surface-container-low px-4 py-3">
          {[
            { label: "Fisik", value: row.summary.currentStock },
            { label: "Terikat", value: row.summary.reservedStock },
            { label: "Tersedia", value: row.summary.availableStock },
          ].map((f) => (
            <div key={f.label} className="min-w-0 px-2 first:pl-0 last:pr-0">
              <dt className="text-meta text-on-surface-variant">{f.label}</dt>
              <dd className="mt-1 text-support font-semibold">
                <Quantity value={f.value} unit={row.unit} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="divide-y divide-outline-variant/30">
          <FactRow
            label="Batas minimum"
            value={<Quantity value={row.summary.minimumStock} unit={row.unit} />}
          />
          {primary?.specification ? (
            <FactRow label="Spesifikasi" value={primary.specification} layout="stacked" />
          ) : null}
          {primary?.brand ? <FactRow label="Merek" value={primary.brand} /> : null}
          {primary?.color ? <FactRow label="Warna" value={primary.color} /> : null}
        </div>
        <div className="border-t border-outline-variant/30 p-4">
          <Button
            variant="secondary"
            size="compact"
            fullWidth
            onClick={() => onOpenMaterial(row.id)}
          >
            Buka rincian material
          </Button>
        </div>
      </GroupedSurface>
      <section className="space-y-2">
        <h3 className="px-1 text-row font-bold">Per lokasi</h3>
        <GroupedSurface variant="desktopPanel" className="divide-y divide-outline-variant/30">
          {row.material.rows.map((item) => (
            <div key={item.inventoryId} className="space-y-2 px-4 py-3">
              <p className="text-support font-semibold">{item.locationName}</p>
              <dl className="grid grid-cols-2 gap-2 text-support">
                <div>
                  <dt className="text-meta text-on-surface-variant">Tersedia</dt>
                  <dd className="mt-1">
                    <Quantity value={item.availableStock} unit={item.unit} />
                  </dd>
                </div>
                <div>
                  <dt className="text-meta text-on-surface-variant">Minimum</dt>
                  <dd className="mt-1">
                    <Quantity value={item.minimumStock} unit={item.unit} />
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </GroupedSurface>
      </section>
    </div>
  );
}
function NeedDetail({ row }: { readonly row: NeedComparison }): React.JSX.Element {
  const can = useCan();
  return (
    <GroupedSurface variant="desktopPanel">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-section font-bold">Kebutuhan RAP</h2>
          <NeedStatus row={row} />
        </div>
        <p className="text-row font-semibold wrap-anywhere">{row.materialName}</p>
        <p className="text-support text-on-surface-variant">
          {row.projectName} · {row.area || "Area belum dicatat"}
        </p>
        <MoneyValue
          amount={row.estimatedTotalCost}
          fractionDigits={Number.isInteger(row.estimatedTotalCost) ? 0 : 2}
          variant="fullDynamic"
          size="lg"
        />
        <p className="text-meta text-on-surface-variant">
          Estimasi biaya seluruh baris RAP, bukan tagihan atau pembayaran.
        </p>
      </div>
      <div className="divide-y divide-outline-variant/30 border-t border-outline-variant/30">
        <FactRow
          label="Kebutuhan dasar"
          value={<Quantity value={row.requiredQuantity} unit={row.unit} />}
        />
        <FactRow label="Buffer" value={<Quantity value={row.bufferQuantity} unit={row.unit} />} />
        <FactRow
          label="Total kebutuhan"
          value={<Quantity value={row.totalQuantity} unit={row.unit} />}
        />
        <FactRow
          label="Stok tersedia"
          value={<Quantity value={row.availableStock} unit={row.unit} />}
        />
        <FactRow
          label="Belum tertutup"
          value={<Quantity value={row.needToBuy} unit={row.unit} />}
        />
      </div>
      <div className="space-y-3 border-t border-outline-variant/30 p-4">
        {!row.materialId ? (
          <p className="flex items-start gap-2 text-support text-warning">
            <AppIcon name="info" className="icon-sm shrink-0" />
            Baris RAP belum tertaut ke Material Master.
          </p>
        ) : null}
        {!row.unit ? (
          <p className="text-support text-on-surface-variant">
            Satuan sumber belum tersedia. Periksa rincian RAP.
          </p>
        ) : null}
        <p className="text-support text-on-surface-variant">
          Stok tersedia belum otomatis dialokasikan ke proyek. Tinjau reservasi dan kebutuhan pada
          RAP.
        </p>
        {row.projectId && can("view:project") && can("view:rap") ? (
          <ButtonLink
            href={`/projects/${row.projectId}?tab=rap`}
            variant="secondary"
            size="compact"
            fullWidth
          >
            Buka RAP proyek
          </ButtonLink>
        ) : null}
      </div>
    </GroupedSurface>
  );
}

export function MaterialDesktopInventory({
  data,
  active = true,
  grouped,
  onOpenMaterial,
}: {
  readonly data: MaterialOperationsDashboard;
  readonly active?: boolean;
  readonly grouped: readonly GroupedMaterial[];
  readonly onOpenMaterial: (id: string) => void;
}): React.JSX.Element {
  const { input, update } = useMaterialDesktopQuery("inventory");
  const [selected, setSelected] = React.useState<string | null>(null);
  const aside = useWorkspaceViewportAtLeast(1280);
  const desktop = useWorkspacePresentation() === "desktop";
  const filtered = React.useMemo(
    () =>
      materialStockComparisons(grouped, input.location).filter((r) => {
        const text = [
          r.material.name,
          r.material.categoryName,
          ...r.material.rows.flatMap((x) => [
            x.specification,
            x.brand,
            x.code,
            x.color,
            x.locationName,
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase("id-ID");
        return (
          text.includes(input.search.trim().toLocaleLowerCase("id-ID")) &&
          (input.status === "ALL" || r.summary.status === input.status)
        );
      }),
    [grouped, input.location, input.search, input.status],
  );
  const sort = stockComparisonColumns.some((c) => c.key === input.sort) ? input.sort : "name";
  const table = desktopTablePage(
    filtered,
    stockComparisonColumns,
    stockKey,
    { column: sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((r) => r.id === selected);
  const context = explicit;
  const { listRef, detailRef } = useListDetailFocus({
    active: active && desktop,
    narrow: !aside,
    selectionKey: context?.id ?? null,
  });
  const filteredState = Boolean(input.search || input.location !== "ALL" || input.status !== "ALL");
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel="Cari stok material"
          placeholder="Cari material, kategori, atau spesifikasi…"
          value={input.search}
          onChange={(search) => update({ search })}
          showClear={false}
          className="min-w-56 flex-1"
        />
        <FilterSelect
          label="Lokasi stok"
          value={input.location}
          onChange={(location) => update({ location })}
          presentation="menu"
          searchable={data.locations.length > 8}
          options={[
            { value: "ALL", label: "Semua lokasi" },
            ...data.locations.map((l) => ({ value: l.id, label: l.name })),
          ]}
        />
        <FilterSelect
          label="Kondisi stok"
          value={input.status}
          onChange={(status) => update({ status })}
          presentation="menu"
          options={[
            { value: "ALL", label: "Semua kondisi" },
            ...["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK", "RESERVED"].map((status) => ({
              value: status,
              label: formatMaterialStatus(status),
            })),
          ]}
        />
        {filteredState ? (
          <Button
            size="mini"
            variant="secondary"
            onClick={() => update({ search: "", location: "ALL", status: "ALL" })}
          >
            Reset filter
          </Button>
        ) : null}
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${context ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
      >
        <div ref={listRef} className={`min-w-0 ${explicit ? "hidden xl:block" : ""}`}>
          <DesktopTable
            ariaLabel="Stok material per lokasi"
            layout="fixed"
            rows={table.rows}
            columns={stockComparisonColumns}
            rowKey={stockKey}
            selectedRowKey={aside ? (context?.id ?? null) : null}
            onRowSelectionChange={(row) => setSelected(row?.id ?? null)}
            sortDescriptor={{ column: sort, direction: input.direction }}
            onSortChange={(sort) =>
              update({ sort: String(sort.column), direction: sort.direction })
            }
            emptyTitle={filteredState ? "Material tidak ditemukan" : "Belum ada stok material"}
            emptyDescription={
              filteredState
                ? "Sesuaikan pencarian, lokasi, atau kondisi stok."
                : "Tambahkan Material Master dan lokasi melalui Pengaturan, lalu catat penerimaan stok."
            }
            footer={
              <DesktopTablePagination
                {...table}
                pageSize={input.pageSize}
                onPageChange={(page) => update({ page })}
                onPageSizeChange={(pageSize) => update({ pageSize })}
                ariaLabel="Halaman stok material"
              />
            }
          />
        </div>
        {context ? (
          <section
            ref={detailRef}
            aria-label="Konteks stok material"
            className={`min-w-0 space-y-3 ${explicit ? "" : "hidden xl:block"}`}
          >
            {explicit ? (
              <Button
                size="mini"
                variant="secondary"
                className="xl:hidden"
                onClick={() => setSelected(null)}
              >
                <AppIcon name="arrow_back" className="icon-xs" />
                Kembali ke daftar
              </Button>
            ) : null}
            <StockDetail row={context} onOpenMaterial={onOpenMaterial} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function MaterialDesktopNeeds({
  data,
  active = true,
  onReload,
}: {
  readonly data: MaterialOperationsDashboard;
  readonly active?: boolean;
  readonly onReload: () => void;
}): React.JSX.Element {
  const { input, update } = useMaterialDesktopQuery("needs");
  const [selected, setSelected] = React.useState<string | null>(null);
  const aside = useWorkspaceViewportAtLeast(1280);
  const desktop = useWorkspacePresentation() === "desktop";
  const rows = React.useMemo(() => materialNeedComparisons(data), [data]);
  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          [r.materialName, r.area, r.projectName]
            .join(" ")
            .toLocaleLowerCase("id-ID")
            .includes(input.search.trim().toLocaleLowerCase("id-ID")) &&
          (input.project === "ALL" || r.projectId === input.project) &&
          (input.status === "ALL" ||
            (input.status === "SHORTAGE" && r.needToBuy > 0) ||
            (input.status === "READY" && r.needToBuy <= 0) ||
            (input.status === "UNLINKED" && !r.materialId)),
      ),
    [rows, input.search, input.project, input.status],
  );
  const sort = needColumns.some((c) => c.key === input.sort) ? input.sort : "name";
  const table = desktopTablePage(
    filtered,
    needColumns,
    needKey,
    { column: sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((r) => r.id === selected);
  const context = explicit;
  const { listRef, detailRef } = useListDetailFocus({
    active: active && desktop,
    narrow: !aside,
    selectionKey: context?.id ?? null,
  });
  const source = data.shortagesSource;
  if (source && source.status !== "ready")
    return (
      <PageState
        kind={source.status === "restricted" ? "restricted" : "error"}
        title={
          source.status === "restricted"
            ? "Akses kebutuhan RAP terbatas"
            : "Kebutuhan RAP belum dapat dimuat"
        }
        description={
          source.message ??
          "Data kebutuhan belum tersedia. Posisi stok dapat dilihat pada tab Inventori."
        }
        actionLabel={source.status === "unavailable" ? "Coba lagi" : undefined}
        onAction={source.status === "unavailable" ? onReload : undefined}
      />
    );
  const hasFilters = Boolean(input.search || input.project !== "ALL" || input.status !== "ALL");
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel="Cari kebutuhan material"
          placeholder="Cari material, area, atau proyek…"
          value={input.search}
          onChange={(search) => update({ search })}
          showClear={false}
          className="min-w-56 flex-1"
        />
        <FilterSelect
          label="Proyek kebutuhan"
          value={input.project}
          onChange={(project) => update({ project })}
          presentation="menu"
          searchable={data.projects.length > 8}
          options={[
            { value: "ALL", label: "Semua proyek" },
            ...data.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <FilterSelect
          label="Status kebutuhan"
          value={input.status}
          onChange={(status) => update({ status })}
          presentation="menu"
          options={[
            { value: "ALL", label: "Semua kebutuhan" },
            { value: "SHORTAGE", label: "Belum tertutup" },
            { value: "READY", label: "Terpenuhi" },
            { value: "UNLINKED", label: "Belum tertaut" },
          ]}
        />
        {hasFilters ? (
          <Button
            size="mini"
            variant="secondary"
            onClick={() => update({ search: "", project: "ALL", status: "ALL" })}
          >
            Reset filter
          </Button>
        ) : null}
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${context ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
      >
        <div ref={listRef} className={`min-w-0 ${explicit ? "hidden xl:block" : ""}`}>
          <DesktopTable
            ariaLabel="Kebutuhan material proyek"
            layout="fixed"
            columns={needColumns}
            rows={table.rows}
            rowKey={needKey}
            selectedRowKey={aside ? (context?.id ?? null) : null}
            onRowSelectionChange={(row) => setSelected(row?.id ?? null)}
            sortDescriptor={{ column: sort, direction: input.direction }}
            onSortChange={(sort) =>
              update({ sort: String(sort.column), direction: sort.direction })
            }
            emptyTitle={
              hasFilters ? "Tidak ada kebutuhan yang sesuai" : "Belum ada baris kebutuhan RAP"
            }
            emptyDescription={
              hasFilters
                ? "Sesuaikan pencarian, proyek, atau status kebutuhan."
                : "Baris material dari RAP yang dapat Anda akses akan tampil di sini."
            }
            footer={
              <DesktopTablePagination
                {...table}
                pageSize={input.pageSize}
                onPageChange={(page) => update({ page })}
                onPageSizeChange={(pageSize) => update({ pageSize })}
                ariaLabel="Halaman kebutuhan material"
              />
            }
          />
        </div>
        {context ? (
          <section
            ref={detailRef}
            aria-label="Konteks kebutuhan RAP"
            className={`min-w-0 space-y-3 ${explicit ? "" : "hidden xl:block"}`}
          >
            {explicit ? (
              <Button
                size="mini"
                variant="secondary"
                className="xl:hidden"
                onClick={() => setSelected(null)}
              >
                <AppIcon name="arrow_back" className="icon-xs" />
                Kembali ke daftar
              </Button>
            ) : null}
            <NeedDetail row={context} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
