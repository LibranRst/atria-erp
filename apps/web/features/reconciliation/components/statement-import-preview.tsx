"use client";

import React from "react";
import {
  AppIcon,
  Button,
  DesktopTable,
  DesktopTablePagination,
  desktopTablePage,
  IconButton,
  MoneyValue,
  type DesktopTableColumn,
} from "@/components/ui";
import type { CashDirection } from "@atria/core/finance/cash-direction";

export type StatementPreviewRow = {
  readonly transactionDate: string;
  readonly description: string;
  readonly amount: number;
  readonly type: CashDirection;
};

type IndexedRow = StatementPreviewRow & { readonly index: number };

export function StatementImportPreview({
  rows,
  pending,
  onToggleDirection,
  onRemove,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  readonly rows: readonly StatementPreviewRow[];
  readonly pending: boolean;
  readonly onToggleDirection: (index: number) => void;
  readonly onRemove: (index: number) => void;
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: 10 | 25 | 50) => void;
}): React.JSX.Element {
  const columns: readonly DesktopTableColumn<IndexedRow>[] = [
    {
      key: "description",
      label: "Deskripsi",
      reviewWidth: 38,
      render: (row) => <span className="wrap-anywhere">{row.description}</span>,
    },
    {
      key: "date",
      label: "Tanggal",
      reviewWidth: 18,
      render: (row) => row.transactionDate,
    },
    {
      key: "amount",
      label: "Nominal",
      align: "end",
      reviewWidth: 24,
      render: (row) => (
        <MoneyValue
          amount={row.amount}
          fractionDigits={Number.isInteger(row.amount) ? 0 : 2}
          variant="compactWithFull"
        />
      ),
    },
    {
      key: "direction",
      label: "Arah",
      reviewWidth: 20,
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            variant="secondary"
            size="compact"
            disabled={pending}
            onClick={() => onToggleDirection(row.index)}
            aria-label={`Ubah arah ${row.description}, saat ini dana ${row.type === "INFLOW" ? "masuk" : "keluar"}`}
          >
            {row.type === "INFLOW" ? "Masuk" : "Keluar"}
          </Button>
          <IconButton
            variant="tertiary"
            size="compact"
            label={`Hapus mutasi ${row.description}`}
            icon={<AppIcon name="close" className="icon-xs" />}
            disabled={pending}
            onClick={() => onRemove(row.index)}
          />
        </div>
      ),
    },
  ];
  const table = desktopTablePage(
    rows.map((row, index) => ({ ...row, index })),
    columns,
    (row) => String(row.index),
    { column: "source", direction: "ascending" },
    page,
    pageSize,
  );
  return (
    <DesktopTable
      ariaLabel="Pratinjau mutasi rekening koran"
      reviewPresentation="desktop"
      rows={table.rows}
      columns={columns}
      rowKey={(row) => String(row.index)}
      footer={
        <DesktopTablePagination
          ariaLabel="Halaman pratinjau mutasi"
          page={table.page}
          pageSize={pageSize}
          total={table.total}
          onPageChange={onPageChange}
          onPageSizeChange={(size): void => {
            onPageSizeChange(size === 25 || size === 50 ? size : 10);
          }}
        />
      }
    />
  );
}
