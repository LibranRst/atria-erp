"use client";

import React from "react";
import type { DesktopTableColumn, DesktopTableProps } from "./desktop-table";

export type DesktopTableSort<Row extends object> = NonNullable<
  DesktopTableProps<Row>["sortDescriptor"]
>;

export type DesktopTableOptions<Row extends object> = {
  readonly initialSort: DesktopTableSort<Row>;
  readonly filterKey: string;
  readonly rowKey: (row: Row) => string;
};

export type DesktopTableState<Row extends object> = {
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly sortDescriptor: DesktopTableSort<Row>;
  readonly onSortChange: (sort: DesktopTableSort<Row>) => void;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

/** The caller supplies the complete authorized collection; comparison precedes pagination. */
export function desktopTablePage<Row extends object>(
  filteredRows: readonly Row[],
  columns: readonly DesktopTableColumn<Row>[],
  rowKey: (row: Row) => string,
  sort: DesktopTableSort<Row>,
  requestedPage: number,
  pageSize: number,
): { readonly rows: readonly Row[]; readonly total: number; readonly page: number } {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const total = filteredRows.length;
  const page = Math.min(
    Math.max(1, Math.floor(requestedPage)),
    Math.max(1, Math.ceil(total / safePageSize)),
  );
  const getSortValue = columns.find((column) => column.key === sort.column)?.sortValue;
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const sorted = getSortValue
    ? [...filteredRows].sort((left: Row, right: Row): number => {
        const a = getSortValue(left);
        const b = getSortValue(right);
        const comparison =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : collator.compare(String(a), String(b));
        if (comparison === 0) return collator.compare(rowKey(left), rowKey(right));
        return sort.direction === "descending" ? -comparison : comparison;
      })
    : filteredRows;
  return {
    rows: sorted.slice((page - 1) * safePageSize, page * safePageSize),
    total,
    page,
  };
}

/** Keep table state above responsive presenters without touching selection or form owners. */
export function useDesktopTable<Row extends object>(
  filteredRows: readonly Row[],
  columns: readonly DesktopTableColumn<Row>[],
  { initialSort, filterKey, rowKey }: DesktopTableOptions<Row>,
): DesktopTableState<Row> {
  const [state, setState] = React.useState(() => ({
    filterKey,
    page: 1,
    pageSize: 10,
    sortDescriptor: initialSort,
  }));
  if (state.filterKey !== filterKey) {
    setState({ ...state, filterKey, page: 1 });
  }
  const requestedPage = state.filterKey === filterKey ? state.page : 1;
  const result = React.useMemo(
    () =>
      desktopTablePage(
        filteredRows,
        columns,
        rowKey,
        state.sortDescriptor,
        requestedPage,
        state.pageSize,
      ),
    [columns, filteredRows, requestedPage, rowKey, state.pageSize, state.sortDescriptor],
  );
  return {
    ...result,
    pageSize: state.pageSize,
    sortDescriptor: state.sortDescriptor,
    onSortChange: (sortDescriptor: DesktopTableSort<Row>): void =>
      setState((previous) => ({ ...previous, filterKey, sortDescriptor, page: 1 })),
    onPageChange: (page: number): void =>
      setState((previous) => ({ ...previous, filterKey, page })),
    onPageSizeChange: (pageSize: number): void =>
      setState((previous) => ({
        ...previous,
        filterKey,
        pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10,
        page: 1,
      })),
  };
}
