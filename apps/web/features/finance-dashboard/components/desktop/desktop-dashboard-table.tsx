"use client";
import React from "react";
import {
  Button,
  DesktopTable,
  FilterSelect,
  SearchInput,
  GroupedSurface,
  InlineStateRow,
  type DesktopTableColumn,
  type SelectOption,
} from "@/components/ui";
import type { DashboardDesktopRow } from "@atria/core/finance/dashboard-desktop";
import type { DesktopDashboardQuery } from "../../hooks/use-desktop-dashboard-data";
import { usePreservedScrollHeight } from "@/lib/hooks/use-preserved-scroll-height";
import { DashboardTableSkeleton } from "./dashboard-desktop-skeletons";

export function DashboardDesktopTable<T extends DashboardDesktopRow>({
  title,
  query,
  rows,
  columns,
  rowKey,
  rowHref,
  onRowAction,
  filters,
}: {
  readonly title: string;
  readonly query: DesktopDashboardQuery;
  readonly rows: readonly T[];
  readonly columns: readonly DesktopTableColumn<T>[];
  readonly rowKey: (row: T) => string;
  readonly rowHref?: (row: T) => string;
  readonly onRowAction?: (row: T) => void;
  readonly filters?: readonly SelectOption[];
}): React.JSX.Element {
  const { input, data, loading, error, update } = query;
  const { containerRef, containerStyle, preserveScrollPosition } = usePreservedScrollHeight(
    `${JSON.stringify(input)}:${loading}`,
  );
  const change = (patch: Partial<typeof input>): void => {
    preserveScrollPosition();
    update(patch);
  };
  return (
    <div ref={containerRef} style={containerStyle} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            ariaLabel={`Cari ${title.toLowerCase()}`}
            placeholder="Cari…"
            value={input.search}
            onChange={(value) => change({ search: value })}
            className="max-w-60"
          />
          {filters ? (
            <FilterSelect
              label="Tampilkan"
              value={input.filter}
              options={filters}
              searchable={false}
              onChange={(value) => change({ filter: value })}
            />
          ) : null}
          {input.tab === "cash" ? (
            <FilterSelect
              label="Jatuh tempo"
              value={input.bucket}
              searchable={false}
              onChange={(value) => {
                if (
                  value === "all" ||
                  value === "OVERDUE" ||
                  value === "TODAY" ||
                  value === "NEXT_7_DAYS" ||
                  value === "LATER"
                )
                  change({ bucket: value });
              }}
              options={[
                { value: "all", label: "Semua waktu" },
                { value: "OVERDUE", label: "Terlambat" },
                { value: "TODAY", label: "Hari ini" },
                { value: "NEXT_7_DAYS", label: "7 hari ke depan" },
                { value: "LATER", label: "Berikutnya" },
              ]}
            />
          ) : null}
        </div>
      </div>
      {error ? (
        <GroupedSurface variant="desktopPanel">
          <InlineStateRow
            icon="warning"
            title="Daftar belum tersedia"
            description={error}
            action={
              <Button size="compact" onClick={query.reload}>
                Coba lagi
              </Button>
            }
          />
        </GroupedSurface>
      ) : loading ? (
        <DashboardTableSkeleton
          label={`Memuat ${title.toLowerCase()}`}
          columns={columns}
          rowCount={input.pageSize}
        />
      ) : (
        <>
          {data?.dataQuality.partial ? (
            <p role="status" className="text-support text-critical">
              Sebagian sumber belum tersedia: {data.dataQuality.unavailableSources.join(", ")}.
              Daftar ini belum lengkap.
            </p>
          ) : null}
          <DesktopTable
            ariaLabel={title}
            columns={columns}
            rows={rows}
            rowKey={rowKey}
            rowHref={rowHref}
            onRowAction={onRowAction}
            emptyTitle={data?.dataQuality.partial ? "Data belum tersedia" : "Tidak ada hasil"}
            emptyDescription="Sesuaikan filter atau pencarian."
            sortDescriptor={{ column: input.sort, direction: input.direction }}
            onSortChange={(next) => {
              const key = String(next.column);
              if (
                key === "priority" ||
                key === "name" ||
                key === "amount" ||
                key === "date" ||
                key === "remaining" ||
                key === "margin"
              )
                change({ sort: key, direction: next.direction });
            }}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3 text-support">
                <span>
                  {data?.total ?? 0} hasil · Halaman {data?.page ?? input.page} dari{" "}
                  {Math.max(1, Math.ceil((data?.total ?? 0) / input.pageSize))}
                </span>
                <div className="flex items-center gap-2">
                  <FilterSelect
                    label="Baris"
                    value={String(input.pageSize)}
                    searchable={false}
                    options={[
                      { value: "10", label: "10 baris" },
                      { value: "25", label: "25 baris" },
                      { value: "50", label: "50 baris" },
                    ]}
                    onChange={(value) =>
                      change({ pageSize: value === "50" ? 50 : value === "25" ? 25 : 10 })
                    }
                  />
                  <Button
                    size="compact"
                    variant="secondary"
                    disabled={(data?.page ?? input.page) <= 1}
                    onClick={() => change({ page: (data?.page ?? input.page) - 1 })}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    size="compact"
                    variant="secondary"
                    disabled={(data?.page ?? input.page) * input.pageSize >= (data?.total ?? 0)}
                    onClick={() => change({ page: (data?.page ?? input.page) + 1 })}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            }
          />
        </>
      )}
    </div>
  );
}
