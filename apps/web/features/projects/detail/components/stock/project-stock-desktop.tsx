"use client";

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
  PageState,
  SearchInput,
  SectionHeader,
  SegmentedTabs,
  StatusBadge,
  desktopTablePage,
  useListDetailFocus,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import type { StockMovement } from "../../types/project-tabs-types";
import type {
  ProjectOperationsSource,
  ProjectStockItem,
  ProjectStockRap,
} from "./project-stock-types";
import {
  filterProjectStockItems,
  filterProjectStockMovements,
  formatStockQuantity,
  projectMovementLabel,
  projectStockCounts,
} from "./project-stock-desktop-model";
import { useProjectStockQuery } from "./use-project-stock-query";

// THESIS: show project coverage separately from warehouse availability and recorded movements.
// Existing Atria Operate grammar: compact divided counts, native tables and independently sized context.
// FIRST VIEWPORT: meaningful material-record counts and shortages, each quantity retains its own unit.
// FINISH: shared controls/overlays own motion, focus, keyboard semantics and responsive presentation.
function Quantity({
  value,
  unit,
}: {
  readonly value: string | number;
  readonly unit: string;
}): React.JSX.Element {
  return (
    <span className="text-sm tabular-nums">
      {formatStockQuantity(value)} {unit}
    </span>
  );
}
function MaterialStatus({ row }: { readonly row: ProjectStockItem }): React.JSX.Element {
  return (
    <StatusBadge
      label={row.needToBuy > 0 ? "Perlu beli" : "Tertutup stok"}
      tone={row.needToBuy > 0 ? "warning" : "neutral"}
    />
  );
}
export const projectStockMaterialColumns: readonly DesktopTableColumn<ProjectStockItem>[] = [
  {
    key: "name",
    label: "Material / area",
    widthPercent: 28,
    sortValue: (row) => row.name,
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold wrap-break-word">{row.name}</p>
        <p className="text-support wrap-break-word text-on-surface-variant">
          {row.area || "Area belum ditentukan"}
        </p>
      </div>
    ),
  },
  {
    key: "required",
    label: "Kebutuhan",
    widthPercent: 15,
    align: "end",
    sortValue: (row) => Number(row.totalQuantity),
    render: (row) => <Quantity value={row.totalQuantity} unit={row.unit} />,
  },
  {
    key: "reserved",
    label: "Reservasi",
    widthPercent: 14,
    align: "end",
    sortValue: (row) => row.reservedQuantity,
    render: (row) => <Quantity value={row.reservedQuantity} unit={row.unit} />,
  },
  {
    key: "used",
    label: "Terpakai",
    widthPercent: 14,
    align: "end",
    sortValue: (row) => row.usedQuantity,
    render: (row) => <Quantity value={row.usedQuantity} unit={row.unit} />,
  },
  {
    key: "shortage",
    label: "Perlu beli",
    widthPercent: 14,
    align: "end",
    sortValue: (row) => row.needToBuy,
    render: (row) => <Quantity value={row.needToBuy} unit={row.unit} />,
  },
  {
    key: "condition",
    label: "Kondisi",
    widthPercent: 15,
    sortValue: (row) => row.needToBuy,
    render: (row) => <MaterialStatus row={row} />,
  },
];
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});
const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});
export const projectStockMovementColumns: readonly DesktopTableColumn<StockMovement>[] = [
  {
    key: "date",
    label: "Waktu",
    widthPercent: 18,
    sortValue: (row) => new Date(row.createdAt).getTime(),
    render: (row) => (
      <div className="space-y-1">
        <p className="text-sm">{dateFormatter.format(new Date(row.createdAt))}</p>
        <p className="text-support text-on-surface-variant">
          {timeFormatter.format(new Date(row.createdAt))} WIB
        </p>
      </div>
    ),
  },
  {
    key: "material",
    label: "Material",
    widthPercent: 26,
    sortValue: (row) => row.material.name,
    render: (row) => <p className="text-sm font-semibold wrap-break-word">{row.material.name}</p>,
  },
  {
    key: "type",
    label: "Gerakan",
    widthPercent: 19,
    sortValue: (row) => projectMovementLabel(row.movementType),
    render: (row) => (
      <StatusBadge
        tone={row.movementType === "WASTE" ? "warning" : "neutral"}
        label={projectMovementLabel(row.movementType)}
      />
    ),
  },
  {
    key: "quantity",
    label: "Jumlah",
    widthPercent: 16,
    align: "end",
    sortValue: (row) => Number(row.quantity),
    render: (row) => <Quantity value={row.quantity} unit={row.material.unit} />,
  },
  {
    key: "location",
    label: "Lokasi / pencatat",
    widthPercent: 21,
    sortValue: (row) => row.location.name,
    render: (row) => (
      <div className="space-y-1">
        <p className="text-sm wrap-break-word">{row.location.name}</p>
        <p className="text-support wrap-break-word text-on-surface-variant">{row.createdBy.name}</p>
      </div>
    ),
  },
];
function MaterialContext({ row }: { readonly row: ProjectStockItem }): React.JSX.Element {
  const qty = (value: string | number): string => `${formatStockQuantity(value)} ${row.unit}`;
  return (
    <section aria-label="Rincian stok material" className="min-w-0 space-y-3">
      <SectionHeader title="Rincian material" />
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-semibold wrap-break-word">{row.name}</h3>
          <p className="text-support wrap-break-word text-on-surface-variant">
            {row.materialName || "Belum terhubung ke master material"} ·{" "}
            {row.area || "Area belum ditentukan"}
          </p>
          <MaterialStatus row={row} />
        </div>
        <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          <FactRow label="Kebutuhan" value={qty(row.totalQuantity)} />
          <FactRow label="Direservasi" value={qty(row.reservedQuantity)} />
          <FactRow label="Diamankan" value={qty(row.securedQuantity)} />
          <FactRow label="Terpakai" value={qty(row.usedQuantity)} />
          <FactRow label="Sisa proyek" value={qty(row.leftoverQuantity)} />
          <FactRow label="Perlu dibeli" value={qty(row.needToBuy)} />
          <FactRow label="Dikembalikan" value={qty(row.returnedQuantity)} />
          <FactRow label="Terbuang" value={qty(row.wasteQuantity)} />
          <FactRow label="Tersedia di gudang" value={qty(row.availableStock)} />
        </div>
        <p className="border-t border-outline-variant/20 p-4 text-support leading-relaxed text-on-surface-variant">
          Stok tersedia di gudang belum otomatis dialokasikan ke proyek. Reservasi dan pemakaian
          dicatat melalui operasi stok; pembayaran mengikuti alur kas.
        </p>
      </GroupedSurface>
    </section>
  );
}
function MovementContext({
  row,
  onOpen,
}: {
  readonly row: StockMovement;
  readonly onOpen: (id: string) => void;
}): React.JSX.Element {
  const unitCost = Number(row.unitCost);
  return (
    <section aria-label="Rincian aktivitas stok" className="min-w-0 space-y-3">
      <SectionHeader title="Rincian aktivitas" />
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-semibold wrap-break-word">{row.material.name}</h3>
          <StatusBadge
            tone={row.movementType === "WASTE" ? "warning" : "neutral"}
            label={projectMovementLabel(row.movementType)}
          />
        </div>
        <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          <FactRow
            label="Jumlah"
            value={`${formatStockQuantity(row.quantity)} ${row.material.unit}`}
          />
          <FactRow label="Lokasi" wrapLabel value={row.location.name} />
          <FactRow label="Pencatat" wrapLabel value={row.createdBy.name} />
          <FactRow
            label="Dicatat"
            value={`${dateFormatter.format(new Date(row.createdAt))} · ${timeFormatter.format(new Date(row.createdAt))} WIB`}
            wrapLabel
          />
          {Number.isFinite(unitCost) && (
            <FactRow
              label="Biaya per unit"
              value={
                <MoneyValue
                  amount={unitCost}
                  fractionDigits={Number.isInteger(unitCost) ? 0 : 2}
                  variant="fullDynamic"
                  size="sm"
                  align="right"
                />
              }
            />
          )}
        </div>
        {row.note && (
          <p className="border-t border-outline-variant/20 p-4 text-support leading-relaxed wrap-break-word text-on-surface-variant">
            {row.note}
          </p>
        )}
        <div className="border-t border-outline-variant/20 p-4">
          <Button
            type="button"
            size="compact"
            variant="secondary"
            fullWidth
            onClick={(): void => onOpen(row.id)}
          >
            Buka detail aktivitas
          </Button>
        </div>
      </GroupedSurface>
    </section>
  );
}
function MaterialsTable({
  items,
  active,
}: {
  readonly items: readonly ProjectStockItem[];
  readonly active: boolean;
}): React.JSX.Element {
  const { input, update } = useProjectStockQuery("materials");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const wide = useWorkspaceViewportAtLeast(1280);
  const filtered = filterProjectStockItems(items, input.search, input.condition);
  const table = desktopTablePage(
    filtered,
    projectStockMaterialColumns,
    (row) => row.id,
    { column: input.sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((row) => row.id === selectedId);
  const context = explicit;
  const desktop = useWorkspacePresentation() === "desktop";
  const { listRef, detailRef } = useListDetailFocus({
    active: active && desktop,
    narrow: !wide,
    selectionKey: context?.id ?? null,
  });
  return (
    <section
      hidden={!active}
      inert={!active}
      aria-label="Material proyek"
      className="min-w-0 space-y-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel="Cari material proyek"
          value={input.search}
          onChange={(search): void => update({ search })}
          placeholder="Cari material atau area..."
          className="min-w-48 flex-1"
        />
        <FilterSelect
          label="Kondisi material"
          presentation="menu"
          value={input.condition}
          onChange={(condition): void => update({ condition })}
          options={[
            { value: "all", label: "Semua kondisi" },
            { value: "need", label: "Perlu beli" },
            { value: "covered", label: "Tertutup stok" },
            { value: "reserved", label: "Direservasi" },
            { value: "used", label: "Terpakai" },
          ]}
        />
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${wide && context ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1"}`}
      >
        <div ref={listRef} hidden={!wide && Boolean(explicit)} className="min-w-0">
          <DesktopTable
            ariaLabel="Stok material proyek"
            layout="fixed"
            rows={table.rows}
            columns={projectStockMaterialColumns}
            rowKey={(row) => row.id}
            selectedRowKey={wide ? (context?.id ?? null) : null}
            onRowSelectionChange={(row) => setSelectedId(row?.id ?? null)}
            sortDescriptor={{ column: input.sort, direction: input.direction }}
            onSortChange={(sort) =>
              update({ sort: String(sort.column), direction: sort.direction })
            }
            emptyTitle={items.length ? "Tidak ada hasil" : "Belum ada kebutuhan material"}
            emptyDescription={
              items.length
                ? "Sesuaikan pencarian atau kondisi material."
                : "Tambahkan kebutuhan material di RAP proyek terlebih dahulu."
            }
            footer={
              <DesktopTablePagination
                page={table.page}
                pageSize={input.pageSize}
                total={table.total}
                onPageChange={(page) => update({ page })}
                onPageSizeChange={(pageSize) =>
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
                size="compact"
                variant="secondary"
                leadingIcon={<AppIcon name="arrow_back" />}
                onClick={(): void => setSelectedId(null)}
              >
                Kembali ke daftar
              </Button>
            )}
            <MaterialContext row={context} />
          </div>
        )}
      </div>
    </section>
  );
}
function MovementsTable({
  rows,
  active,
  onOpen,
}: {
  readonly rows: readonly StockMovement[];
  readonly active: boolean;
  readonly onOpen: (id: string) => void;
}): React.JSX.Element {
  const { input, update } = useProjectStockQuery("activity");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const wide = useWorkspaceViewportAtLeast(1280);
  const filtered = filterProjectStockMovements(rows, input.search, input.condition, input.location);
  const table = desktopTablePage(
    filtered,
    projectStockMovementColumns,
    (row) => row.id,
    { column: input.sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const explicit = table.rows.find((row) => row.id === selectedId);
  const context = explicit;
  const desktop = useWorkspacePresentation() === "desktop";
  const { listRef, detailRef } = useListDetailFocus({
    active: active && desktop,
    narrow: !wide,
    selectionKey: context?.id ?? null,
  });
  const types = [...new Set(rows.map((row) => row.movementType))].sort();
  const locations = [...new Set(rows.map((row) => row.location.name))].sort();
  return (
    <section
      hidden={!active}
      inert={!active}
      aria-label="Aktivitas stok proyek"
      className="min-w-0 space-y-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel="Cari aktivitas stok"
          value={input.search}
          onChange={(search): void => update({ search })}
          placeholder="Cari material, lokasi, atau pencatat..."
          className="min-w-48 flex-1"
        />
        <FilterSelect
          label="Jenis gerakan"
          presentation="menu"
          value={input.condition}
          onChange={(condition): void => update({ condition })}
          options={[
            { value: "all", label: "Semua gerakan" },
            ...types.map((value) => ({ value, label: projectMovementLabel(value) })),
          ]}
        />
        <FilterSelect
          label="Lokasi stok"
          presentation="menu"
          searchable={locations.length > 6}
          value={input.location}
          onChange={(location): void => update({ location })}
          options={[
            { value: "all", label: "Semua lokasi" },
            ...locations.map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${wide && context ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1"}`}
      >
        <div ref={listRef} hidden={!wide && Boolean(explicit)} className="min-w-0">
          <DesktopTable
            ariaLabel="Aktivitas stok proyek"
            layout="fixed"
            rows={table.rows}
            columns={projectStockMovementColumns}
            rowKey={(row) => row.id}
            selectedRowKey={wide ? (context?.id ?? null) : null}
            onRowSelectionChange={(row) => setSelectedId(row?.id ?? null)}
            sortDescriptor={{ column: input.sort, direction: input.direction }}
            onSortChange={(sort) =>
              update({ sort: String(sort.column), direction: sort.direction })
            }
            emptyTitle={rows.length ? "Tidak ada hasil" : "Belum ada aktivitas stok"}
            emptyDescription={
              rows.length
                ? "Sesuaikan pencarian, jenis gerakan, atau lokasi."
                : "Aktivitas muncul setelah operasi material dicatat."
            }
            footer={
              <DesktopTablePagination
                page={table.page}
                pageSize={input.pageSize}
                total={table.total}
                onPageChange={(page) => update({ page })}
                onPageSizeChange={(pageSize) =>
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
                size="compact"
                variant="secondary"
                leadingIcon={<AppIcon name="arrow_back" />}
                onClick={(): void => setSelectedId(null)}
              >
                Kembali ke daftar
              </Button>
            )}
            <MovementContext row={context} onOpen={onOpen} />
          </div>
        )}
      </div>
    </section>
  );
}
export function ProjectStockDesktop({
  rap,
  source,
  stockMovements,
  onActivityOpen,
}: {
  readonly rap: ProjectStockRap | null;
  readonly source: ProjectOperationsSource;
  readonly stockMovements: readonly StockMovement[];
  readonly onActivityOpen: (id: string) => void;
}): React.JSX.Element {
  const view = useBrowserUrlSearchParam("stock-view") === "activity" ? "activity" : "materials";
  const counts = projectStockCounts(rap?.items ?? []);
  const known = source.status === "ready" || source.status === "missing";
  const facts = [
    { label: "Material RAP", value: counts.materials },
    { label: "Perlu dibeli", value: counts.shortage },
    { label: "Direservasi", value: counts.reserved },
    { label: "Sudah terpakai", value: counts.used },
  ];
  return (
    <div className="min-w-0 space-y-4">
      <header className="min-h-10 pr-44">
        <h2 className="text-lg font-semibold text-on-surface">Stok proyek</h2>
        <p className="mt-1 text-support text-on-surface-variant">
          Kebutuhan material, posisi stok, dan gerakan yang sudah dicatat.
        </p>
      </header>
      <GroupedSurface variant="desktopPanel" className="p-4">
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/25">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0 px-4 first:pl-0 last:pr-0">
              <dt className="text-support text-on-surface-variant">{fact.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {known ? fact.value : "—"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-support text-on-surface-variant">
          {known
            ? "Hitungan menunjukkan jumlah baris material. Setiap kuantitas mengikuti satuan materialnya."
            : "Posisi material belum dapat dinilai dari sumber yang tersedia."}
        </p>
      </GroupedSurface>
      {source.status === "restricted" || source.status === "unavailable" ? (
        <PageState
          kind={source.status === "restricted" ? "restricted" : "error"}
          title={
            source.status === "restricted"
              ? "Akses stok dibatasi"
              : "Posisi material belum tersedia"
          }
          description={
            source.message ??
            (source.status === "restricted"
              ? "Akun ini belum memiliki izin melihat stok proyek."
              : "Data stok gagal dimuat. Segarkan halaman untuk mencoba lagi.")
          }
          compact
        />
      ) : (
        <>
          <SegmentedTabs
            ariaLabel="Tampilan stok proyek"
            value={view}
            onChange={(next): void => {
              const url = new URL(window.location.href);
              url.searchParams.set("stock-view", next);
              updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
            }}
            options={[
              {
                value: "materials",
                label: "Material",
                count: known ? counts.materials : undefined,
                countLabel: "material",
              },
              {
                value: "activity",
                label: "Aktivitas",
                count: stockMovements.length,
                countLabel: "gerakan stok",
              },
            ]}
          />
          {known ? (
            <MaterialsTable items={rap?.items ?? []} active={view === "materials"} />
          ) : view === "materials" ? (
            <p className="px-1 text-support text-on-surface-variant">
              Kuantitas belum tersedia; tidak ditampilkan sebagai stok kosong atau terpenuhi.
            </p>
          ) : null}
          <MovementsTable
            rows={stockMovements}
            active={view === "activity"}
            onOpen={onActivityOpen}
          />
        </>
      )}
    </div>
  );
}
