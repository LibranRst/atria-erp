"use client";

import React from "react";
import { Button } from "../button/button";
import { FilterSelect } from "../form/select-form-controls";

export type DesktopTablePaginationProps = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly pageSizeOptions?: readonly number[];
  readonly ariaLabel?: string;
};

/** Controlled presentation only; filtering and full-result sorting belong to the collection owner. */
export function DesktopTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  ariaLabel = "Navigasi halaman tabel",
}: DesktopTablePaginationProps): React.JSX.Element {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="text-support text-on-surface-variant tabular-nums">
        {total.toLocaleString("id-ID")} hasil · Halaman {currentPage} dari {pageCount}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Jumlah baris"
          value={String(pageSize)}
          options={pageSizeOptions.map((size) => ({ value: String(size), label: `${size} baris` }))}
          onChange={(next: string): void => onPageSizeChange(Number(next))}
          presentation="menu"
        />
        <Button
          type="button"
          variant="secondary"
          size="compact"
          disabled={currentPage <= 1}
          onClick={(): void => onPageChange(currentPage - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          disabled={currentPage >= pageCount}
          onClick={(): void => onPageChange(currentPage + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
