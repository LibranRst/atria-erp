"use client";

import React from "react";
import {
  desktopTablePage,
  type DesktopTableColumn,
  type DesktopTableSort,
  type DesktopTableState,
} from "@/components/ui";
import { subscribeToUrl, updateBrowserUrl } from "@/lib/utils/use-url-search-param";

type QueryPatch = Readonly<Record<string, string | number | null>>;
export type ExpenseDesktopQuery = {
  readonly projectId?: string;
  readonly read: (key: string, fallback: string) => string;
  readonly update: (patch: QueryPatch) => void;
};

/** Standalone and embedded controls own separate canonical URL namespaces. */
export function useExpenseDesktopQuery(
  projectId: string | undefined,
  section: "claims" | "vendor",
): ExpenseDesktopQuery {
  const search = React.useSyncExternalStore(
    subscribeToUrl,
    (): string => window.location.search,
    (): string => "",
  );
  const prefix = `project-${projectId ?? "inbox"}-expenses-${section}-`;
  const read = (key: string, fallback: string): string =>
    new URLSearchParams(search).get(`${prefix}${key}`) ?? fallback;
  const update = (patch: QueryPatch): void => {
    const keys = Object.keys(patch);
    const sharedVendorFilter = keys.some((key) =>
      ["search", "project", "vendor", "date"].includes(key),
    );
    const reset: QueryPatch = {
      ...(section === "claims" && keys.some((key) => key !== "page") ? { page: 1 } : {}),
      ...(section === "vendor" &&
      (sharedVendorFilter ||
        keys.some(
          (key) => key === "bill-status" || (key.startsWith("bills-") && key !== "bills-page"),
        ))
        ? { "bills-page": 1 }
        : {}),
      ...(section === "vendor" &&
      (sharedVendorFilter ||
        keys.some(
          (key) =>
            key === "payment-status" || (key.startsWith("payments-") && key !== "payments-page"),
        ))
        ? { "payments-page": 1 }
        : {}),
      ...patch,
    };
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(reset)) {
      if (value === null) params.delete(`${prefix}${key}`);
      else params.set(`${prefix}${key}`, String(value));
    }
    const query = params.toString();
    updateBrowserUrl(
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      "replace",
    );
  };
  return { projectId, read, update };
}

export function useExpenseDesktopTable<Row extends object>(
  rows: readonly Row[],
  columns: readonly DesktopTableColumn<Row>[],
  options: {
    readonly query: ExpenseDesktopQuery;
    readonly prefix?: "bills-" | "payments-";
    readonly initialSort: DesktopTableSort<Row>;
    readonly filterKey: string;
    readonly rowKey: (row: Row) => string;
  },
): DesktopTableState<Row> {
  const { query, prefix = "", initialSort, rowKey } = options;
  const requestedSort = query.read(`${prefix}sort`, String(initialSort.column));
  const direction = query.read(`${prefix}direction`, initialSort.direction);
  const sortDescriptor: DesktopTableSort<Row> = {
    column: columns.find((column) => column.key === requestedSort)?.key ?? initialSort.column,
    direction: direction === "descending" ? "descending" : "ascending",
  };
  const requestedSize = Number(query.read(`${prefix}pageSize`, "10"));
  const pageSize = requestedSize === 25 || requestedSize === 50 ? requestedSize : 10;
  const requestedPage = Number(query.read(`${prefix}page`, "1"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = desktopTablePage(rows, columns, rowKey, sortDescriptor, page, pageSize);
  return {
    ...result,
    pageSize,
    sortDescriptor,
    onSortChange: (sort): void =>
      query.update({
        [`${prefix}sort`]: String(sort.column),
        [`${prefix}direction`]: sort.direction,
      }),
    onPageChange: (next): void => query.update({ [`${prefix}page`]: next }),
    onPageSizeChange: (next): void =>
      query.update({ [`${prefix}pageSize`]: next === 25 || next === 50 ? next : 10 }),
  };
}
