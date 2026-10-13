"use client";

import React from "react";
import {
  AppIcon,
  Button,
  DesktopTable,
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
}: {
  readonly rows: readonly StatementPreviewRow[];
  readonly pending: boolean;
  readonly onToggleDirection: (index: number) => void;
  readonly onRemove: (index: number) => void;
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
      render: (row) => <MoneyValue amount={row.amount} variant="compactWithFull" />,
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
  return (
    <DesktopTable
      ariaLabel="Pratinjau mutasi rekening koran"
      reviewPresentation="desktop"
      rows={rows.map((row, index) => ({ ...row, index }))}
      columns={columns}
      rowKey={(row) => String(row.index)}
    />
  );
}
