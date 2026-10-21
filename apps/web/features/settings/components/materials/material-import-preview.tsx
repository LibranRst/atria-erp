"use client";

import React from "react";
import type {
  MaterialImportInput,
  MaterialImportPreview,
} from "@/app/actions/settings/material-import";
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

type ValidRow = MaterialImportPreview["items"][number];
type ErrorRow = MaterialImportPreview["errors"][number] & { readonly name: string };
const columns: readonly DesktopTableColumn<ValidRow>[] = [
  { key: "row", label: "Baris", widthPercent: 7, render: (row) => row.rowNumber },
  {
    key: "material",
    label: "Material",
    widthPercent: 27,
    render: (row) => (
      <div className="min-w-0 space-y-1 wrap-anywhere whitespace-normal">
        <p className="font-semibold">{row.name}</p>
        {row.code && <p className="text-support">Kode: {row.code}</p>}
        {row.brand && <p className="text-support">Merek: {row.brand}</p>}
        {row.color && <p className="text-support">Warna: {row.color}</p>}
        {row.specification && (
          <p className="text-support text-on-surface-variant">{row.specification}</p>
        )}
      </div>
    ),
  },
  {
    key: "category",
    label: "Kategori / satuan",
    widthPercent: 16,
    render: (row) => (
      <div className="space-y-1 wrap-anywhere whitespace-normal">
        <p>{row.categoryName}</p>
        <p className="text-support text-on-surface-variant">Satuan: {row.unit}</p>
      </div>
    ),
  },
  {
    key: "location",
    label: "Lokasi / vendor",
    widthPercent: 20,
    render: (row) => (
      <div className="space-y-1 wrap-anywhere whitespace-normal">
        <p>{row.locationName}</p>
        <p className="text-support text-on-surface-variant">{row.vendorName || "Tanpa vendor"}</p>
      </div>
    ),
  },
  {
    key: "minimum",
    label: "Stok minimum",
    widthPercent: 13,
    align: "end",
    render: (row) => (
      <span className="whitespace-normal tabular-nums">
        {row.minimumStock.toLocaleString("id-ID", { maximumFractionDigits: 20 })} {row.unit}
      </span>
    ),
  },
  {
    key: "price",
    label: "Harga acuan",
    widthPercent: 17,
    align: "end",
    render: (row) => (
      <MoneyValue
        amount={row.lastPurchasePrice}
        variant="fullDynamic"
        fractionDigits={Number.isInteger(row.lastPurchasePrice) ? 0 : 2}
        size="sm"
        align="right"
      />
    ),
  },
];
const errorColumns: readonly DesktopTableColumn<ErrorRow>[] = [
  { key: "row", label: "Baris", widthPercent: 10, render: (row) => row.rowNumber },
  {
    key: "name",
    label: "Material",
    widthPercent: 30,
    render: (row) => (
      <span className="wrap-anywhere whitespace-normal">{row.name || "Nama belum diisi"}</span>
    ),
  },
  {
    key: "error",
    label: "Perlu diperbaiki",
    widthPercent: 60,
    render: (row) => <p className="wrap-anywhere whitespace-normal text-error">{row.message}</p>,
  },
];

export function MaterialImportPreviewContent({
  input,
  preview,
}: {
  readonly input: MaterialImportInput;
  readonly preview: MaterialImportPreview;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<"valid" | "errors">(
    preview.errors.length ? "errors" : "valid",
  );
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<10 | 25 | 50>(10);
  const names = React.useMemo(
    () => new Map(input.rows.map((row) => [row.rowNumber, row.name])),
    [input],
  );
  const errors = React.useMemo(
    () => preview.errors.map((row) => ({ ...row, name: names.get(row.rowNumber) ?? "" })),
    [names, preview],
  );
  const validPage = desktopTablePage(
    preview.items,
    columns,
    (row) => String(row.rowNumber),
    { column: "row", direction: "ascending" },
    page,
    pageSize,
  );
  const errorPage = desktopTablePage(
    errors,
    errorColumns,
    (row) => String(row.rowNumber),
    { column: "row", direction: "ascending" },
    page,
    pageSize,
  );
  const active = view === "valid" ? validPage : errorPage;
  return (
    <section className="min-w-0 space-y-3" aria-label="Pratinjau Material Master">
      <SegmentedTabs
        value={view}
        onChange={(next) => {
          setView(next);
          setPage(1);
        }}
        ariaLabel="Hasil validasi material"
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
            countLabel: `${preview.items.length} material valid`,
          },
        ]}
      />
      <p className="px-1 text-support text-on-surface-variant">
        {input.rows.length} baris dibaca. Periksa identitas, default inventori, dan harga acuan
        sebelum mengimpor.
      </p>
      <div hidden={!desktop} inert={!desktop}>
        {view === "valid" ? (
          <DesktopTable
            ariaLabel="Material valid dari CSV"
            columns={columns}
            rows={validPage.rows}
            rowKey={(row) => String(row.rowNumber)}
            emptyTitle="Belum ada material valid"
            emptyDescription="Periksa baris yang perlu diperbaiki."
          />
        ) : (
          <DesktopTable
            ariaLabel="Kesalahan CSV material"
            columns={errorColumns}
            rows={errorPage.rows}
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
                      Baris {row.rowNumber} · {row.name}
                    </p>
                    <p className="text-meta text-on-surface-variant">
                      {row.categoryName} · {row.locationName} · {row.unit}
                    </p>
                    <p className="text-meta text-on-surface-variant">
                      Stok minimum {row.minimumStock.toLocaleString("id-ID")} {row.unit} ·{" "}
                      {row.vendorName || "Tanpa vendor"}
                    </p>
                    <MoneyValue
                      amount={row.lastPurchasePrice}
                      fractionDigits={Number.isInteger(row.lastPurchasePrice) ? 0 : 2}
                      variant="fullDynamic"
                      size="sm"
                    />
                  </div>
                ))
              : errorPage.rows.map((row) => (
                  <div key={row.rowNumber} className="space-y-1 px-4 py-3">
                    <p className="text-support font-semibold">
                      Baris {row.rowNumber} · {row.name || "Nama belum diisi"}
                    </p>
                    <p className="text-meta text-error">{row.message}</p>
                  </div>
                ))}
            {active.total === 0 && (
              <p className="px-4 py-3 text-support text-on-surface-variant">
                {view === "errors" ? "Tidak ada kesalahan baris." : "Belum ada material valid."}
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
        ariaLabel="Halaman pratinjau material"
      />
    </section>
  );
}
