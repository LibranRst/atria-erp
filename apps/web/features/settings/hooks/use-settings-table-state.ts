"use client";

import React from "react";
import type { DesktopTableColumn, DesktopTableProps } from "@/components/ui";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";

type SettingsSortDescriptor<Row extends object> = NonNullable<
  DesktopTableProps<Row>["sortDescriptor"]
>;

export type SettingsTableState<Row extends object> = {
  readonly page: number;
  readonly pageSize: number;
  readonly sortDescriptor: SettingsSortDescriptor<Row>;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onSortChange: (descriptor: SettingsSortDescriptor<Row>) => void;
  readonly resetPage: () => void;
};

/** Collection state stays with the manager when its responsive presenter changes. */
export function useSettingsTableState<Row extends object>(
  initialColumn: string,
  namespace?: string,
): SettingsTableState<Row> {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortDescriptor, setSortDescriptor] = React.useState<SettingsSortDescriptor<Row>>({
    column: initialColumn,
    direction: "ascending",
  });
  const requestedPage = Number(useBrowserUrlSearchParam(`${namespace}-page`) ?? 1);
  const requestedSize = Number(useBrowserUrlSearchParam(`${namespace}-pageSize`) ?? 10);
  const requestedColumn = useBrowserUrlSearchParam(`${namespace}-sort`) ?? initialColumn;
  const requestedDirection = useBrowserUrlSearchParam(`${namespace}-direction`);
  if (namespace) {
    return {
      page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
      pageSize: requestedSize === 25 || requestedSize === 50 ? requestedSize : 10,
      sortDescriptor: {
        column: requestedColumn,
        direction: requestedDirection === "descending" ? "descending" : "ascending",
      },
      onPageChange: (next: number): void => updateSettingsQuery(namespace, { page: next }),
      onPageSizeChange: (next: number): void =>
        updateSettingsQuery(namespace, {
          pageSize: next === 25 || next === 50 ? next : 10,
          page: 1,
        }),
      onSortChange: (next: SettingsSortDescriptor<Row>): void =>
        updateSettingsQuery(namespace, {
          sort: String(next.column),
          direction: next.direction,
          page: 1,
        }),
      resetPage: (): void => updateSettingsQuery(namespace, { page: 1 }),
    };
  }
  return {
    page,
    pageSize,
    sortDescriptor,
    onPageChange: setPage,
    onPageSizeChange: (next: number): void => {
      setPageSize(next);
      setPage(1);
    },
    onSortChange: (next: SettingsSortDescriptor<Row>): void => {
      setSortDescriptor(next);
      setPage(1);
    },
    resetPage: (): void => setPage(1),
  };
}

function updateSettingsQuery(
  namespace: string,
  patch: Readonly<Record<string, string | number>>,
): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch))
    url.searchParams.set(`${namespace}-${key}`, String(value));
  updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
}

/** Catalog controls survive conditional peer modules without retaining hidden form owners. */
export function useSettingsFilterState(
  namespace: string | undefined,
  key: string,
  initialValue: string,
): readonly [string, (next: string) => void] {
  const [localValue, setLocalValue] = React.useState(initialValue);
  const queryValue = useBrowserUrlSearchParam(`${namespace}-${key}`);
  return [
    namespace ? (queryValue ?? initialValue) : localValue,
    (next: string): void => {
      if (namespace) updateSettingsQuery(namespace, { [key]: next, page: 1 });
      else setLocalValue(next);
    },
  ];
}

/** Sort the complete filtered source before taking a page, never only visible rows. */
export function settingsTablePageRows<Row extends object>(
  rows: readonly Row[],
  columns: readonly DesktopTableColumn<Row>[],
  state: Pick<SettingsTableState<Row>, "page" | "pageSize" | "sortDescriptor">,
): readonly Row[] {
  const column = columns.find((candidate) => candidate.key === state.sortDescriptor.column);
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const sorted = column?.sortValue
    ? [...rows].sort((left: Row, right: Row): number => {
        const a = column.sortValue?.(left) ?? "";
        const b = column.sortValue?.(right) ?? "";
        const compared =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : collator.compare(String(a), String(b));
        return state.sortDescriptor.direction === "descending" ? -compared : compared;
      })
    : rows;
  const pageSize = Math.max(1, state.pageSize);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  return sorted.slice((page - 1) * pageSize, page * pageSize);
}
