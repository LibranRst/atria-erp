"use client";

import React from "react";
import type { InitialStockImportPreview } from "@/app/actions/material/opening-inventory";
import {
  DesktopTable,
  DesktopTablePagination,
  GroupedSurface,
  MoneyValue,
  SegmentedTabs,
  desktopTablePage,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

type Row = InitialStockImportPreview["items"][number];
type ErrorRow = InitialStockImportPreview["errors"][number];
const columns: readonly DesktopTableColumn<Row>[] = [
  { key: "row", label: "Baris", widthPercent: 7, render: (row) => row.rowNumber },
  {
    key: "name",
    label: "Material",
    widthPercent: 26,
    render: (row) => (
      <div className="space-y-1 wrap-anywhere whitespace-normal">
        <p className="font-semibold">{row.materialName}</p>
        <p className="text-support text-on-surface-variant">{row.locationName}</p>
      </div>
    ),
  },
  {
    key: "quantity",
    label: "Jumlah fisik",
    widthPercent: 20,
    align: "end",
    render: (row) => (
      <span className="whitespace-normal tabular-nums">
        {row.quantity.toLocaleString("id-ID", { maximumFractionDigits: 20 })}{" "}
        {row.unit ?? "Satuan belum tersedia"}
      </span>
    ),
  },
  {
    key: "cost",
    label: "Harga pokok / unit",
    widthPercent: 23,
    align: "end",
    render: (row) => (
      <MoneyValue
        amount={row.unitCost}
        fractionDigits={Number.isInteger(row.unitCost) ? 0 : 2}
        variant="fullDynamic"
        size="sm"
        align="right"
      />
    ),
  },
  {
    key: "total",
    label: "Nilai baris",
    widthPercent: 24,
    align: "end",
    render: (row) => (
      <MoneyValue
        amount={row.quantity * row.unitCost}
        fractionDigits={Number.isInteger(row.quantity * row.unitCost) ? 0 : 2}
        variant="fullDynamic"
        size="sm"
        align="right"
      />
    ),
  },
];
const errorColumns: readonly DesktopTableColumn<ErrorRow>[] = [
  { key: "row", label: "Baris", widthPercent: 12, render: (row) => row.rowNumber },
  {
    key: "error",
    label: "Perlu diperbaiki",
    widthPercent: 88,
    render: (row) => <p className="wrap-anywhere whitespace-normal text-error">{row.message}</p>,
  },
];

export function OpeningInventoryCsvPreview({
  preview,
}: {
  readonly preview: InitialStockImportPreview;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<"valid" | "errors">(
    preview.errors.length ? "errors" : "valid",
  );
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<10 | 25 | 50>(10);
  const validPage = desktopTablePage(
    preview.items,
    columns,
    (row) => String(row.rowNumber),
    { column: "row", direction: "ascending" },
    page,
    pageSize,
  );
  const errorPage = desktopTablePage(
    preview.errors,
    errorColumns,
    (row) => String(row.rowNumber),
    { column: "row", direction: "ascending" },
    page,
    pageSize,
  );
  const active = view === "valid" ? validPage : errorPage;
  return (
    <section className="min-w-0 space-y-3" aria-label="Pratinjau CSV saldo awal stok">
      <SegmentedTabs
        value={view}
        onChange={(next) => {
          setView(next);
          setPage(1);
        }}
        ariaLabel="Hasil validasi saldo awal"
        options={[
          {
            value: "errors",
            label: "Perlu diperbaiki",
            count: preview.errors.length,
            countLabel: `${preview.errors.length} baris perlu diperbaiki`,
          },
          {
            value: "valid",
            label: "Valid",
            count: preview.items.length,
            countLabel: `${preview.items.length} baris saldo awal valid`,
          },
        ]}
      />
      <p className="px-1 text-support text-on-surface-variant">
        {preview.items.length + preview.errors.length} baris dibaca. Harga pokok dan jumlah fisik
        tidak mencatat pembayaran.
      </p>
      <div hidden={!desktop} inert={!desktop}>
        {view === "valid" ? (
          <DesktopTable
            ariaLabel="Saldo awal valid dari CSV"
            rows={validPage.rows}
            columns={columns}
            rowKey={(row) => String(row.rowNumber)}
            emptyTitle="Belum ada baris valid"
            emptyDescription="Periksa baris yang perlu diperbaiki."
          />
        ) : (
          <DesktopTable
            ariaLabel="Kesalahan CSV saldo awal"
            rows={errorPage.rows}
            columns={errorColumns}
            rowKey={(row) => String(row.rowNumber)}
            emptyTitle="Tidak ada kesalahan baris"
            emptyDescription="Seluruh baris telah melewati validasi."
          />
        )}
      </div>
      <div hidden={desktop} inert={desktop}>
        <GroupedSurface>
          <div className="divide-y divide-outline-variant/20">
            {view === "valid"
              ? validPage.rows.map((row) => (
                  <div key={row.rowNumber} className="space-y-1 px-4 py-3">
                    <p className="text-support font-semibold">
                      Baris {row.rowNumber} · {row.materialName}
                    </p>
                    <p className="text-meta text-on-surface-variant">
                      {row.locationName} ·{" "}
                      {row.quantity.toLocaleString("id-ID", { maximumFractionDigits: 20 })}{" "}
                      {row.unit ?? "Satuan belum tersedia"}
                    </p>
                    <p className="text-meta text-on-surface-variant">Harga pokok per unit</p>
                    <MoneyValue
                      amount={row.unitCost}
                      fractionDigits={Number.isInteger(row.unitCost) ? 0 : 2}
                      variant="fullDynamic"
                      size="sm"
                    />
                    <MoneyValue
                      amount={row.quantity * row.unitCost}
                      fractionDigits={Number.isInteger(row.quantity * row.unitCost) ? 0 : 2}
                      variant="fullDynamic"
                      size="sm"
                    />
                  </div>
                ))
              : errorPage.rows.map((row) => (
                  <div key={row.rowNumber} className="space-y-1 px-4 py-3">
                    <p className="text-support font-semibold">Baris {row.rowNumber}</p>
                    <p className="text-meta text-error">{row.message}</p>
                  </div>
                ))}
            {active.total === 0 && (
              <p className="px-4 py-3 text-support text-on-surface-variant">
                {view === "errors" ? "Tidak ada kesalahan baris." : "Belum ada baris valid."}
              </p>
            )}
          </div>
        </GroupedSurface>
      </div>
      <DesktopTablePagination
        page={active.page}
        pageSize={pageSize}
        total={active.total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size === 25 || size === 50 ? size : 10);
          setPage(1);
        }}
        ariaLabel="Halaman pratinjau saldo awal"
      />
    </section>
  );
}
