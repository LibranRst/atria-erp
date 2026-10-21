import React from "react";
import type { DesktopTableColumn, DesktopTableProps } from "@/components/ui";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import {
  getAdministrationTablePage,
  type AdministrationTableQuery,
} from "../utils/administration-table";

export type AdministrationTableController<Row extends object> = {
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly filter: string;
  readonly sort: NonNullable<DesktopTableProps<Row>["sortDescriptor"]>;
  readonly onSearchChange: (search: string) => void;
  readonly onFilterChange: (filter: string) => void;
  readonly onSortChange: (sort: NonNullable<DesktopTableProps<Row>["sortDescriptor"]>) => void;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

/** This hook stays in the domain owner when the responsive presenter changes. */
export function useAdministrationTable<Row extends object>(
  rows: readonly Row[],
  columns: readonly DesktopTableColumn<Row>[],
  searchText: (row: Row) => string,
  matchesFilter: (row: Row, filter: string) => boolean,
  namespace?: string,
): AdministrationTableController<Row> {
  const [localQuery, setQuery] = React.useState<AdministrationTableQuery<Row>>({
    search: "",
    filter: "all",
    page: 1,
    pageSize: 10,
    sort: { column: "name", direction: "ascending" },
  });
  const key = namespace ?? "administration-local";
  const search = useBrowserUrlSearchParam(`${key}-search`);
  const filter = useBrowserUrlSearchParam(`${key}-filter`);
  const requestedPage = Number(useBrowserUrlSearchParam(`${key}-page`) ?? "1");
  const requestedSize = Number(useBrowserUrlSearchParam(`${key}-pageSize`) ?? "10");
  const column = useBrowserUrlSearchParam(`${key}-sort`);
  const direction = useBrowserUrlSearchParam(`${key}-direction`);
  const query: AdministrationTableQuery<Row> = namespace
    ? {
        search: search ?? "",
        filter: ["active", "inactive", "system", "custom"].includes(filter ?? "")
          ? (filter ?? "all")
          : "all",
        page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
        pageSize: [10, 25, 50].includes(requestedSize) ? requestedSize : 10,
        sort: {
          column: columns.some((item) => item.key === column && item.sortable)
            ? (column ?? "name")
            : "name",
          direction: direction === "descending" ? "descending" : "ascending",
        },
      }
    : localQuery;

  function change(patch: Partial<AdministrationTableQuery<Row>>): void {
    if (!namespace) {
      setQuery((current) => ({ ...current, ...patch }));
      return;
    }
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(patch)) {
      if (name === "sort") continue;
      url.searchParams.set(`${namespace}-${name}`, String(value));
    }
    if (patch.sort) {
      url.searchParams.set(`${namespace}-sort`, String(patch.sort.column));
      url.searchParams.set(`${namespace}-direction`, patch.sort.direction);
    }
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  }
  const page = getAdministrationTablePage(rows, query, columns, searchText, matchesFilter);
  return {
    ...page,
    pageSize: query.pageSize,
    search: query.search,
    filter: query.filter,
    sort: query.sort,
    onSearchChange: (search: string): void => change({ search, page: 1 }),
    onFilterChange: (filter: string): void => change({ filter, page: 1 }),
    onSortChange: (sort): void => change({ sort, page: 1 }),
    onPageChange: (next: number): void => change({ page: next }),
    onPageSizeChange: (pageSize: number): void => change({ pageSize, page: 1 }),
  };
}
