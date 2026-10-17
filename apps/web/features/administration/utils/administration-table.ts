import type { DesktopTableColumn, DesktopTableProps } from "@/components/ui";

export type AdministrationTableQuery<Row extends object> = {
  readonly search: string;
  readonly filter: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: NonNullable<DesktopTableProps<Row>["sortDescriptor"]>;
};

export type AdministrationTablePage<Row extends object> = {
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: number;
};

/** Complete collections are filtered and sorted before the visible page is selected. */
export function getAdministrationTablePage<Row extends object>(
  rows: readonly Row[],
  query: AdministrationTableQuery<Row>,
  columns: readonly DesktopTableColumn<Row>[],
  searchText: (row: Row) => string,
  matchesFilter: (row: Row, filter: string) => boolean,
): AdministrationTablePage<Row> {
  const normalized = query.search.trim().toLocaleLowerCase("id-ID");
  const filtered = rows.filter(
    (row: Row): boolean =>
      matchesFilter(row, query.filter) &&
      (!normalized || searchText(row).toLocaleLowerCase("id-ID").includes(normalized)),
  );
  const column = columns.find((item) => item.key === query.sort.column);
  const sortValue = column?.sortValue;
  if (sortValue) {
    const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
    filtered.sort((left: Row, right: Row): number => {
      const a = sortValue(left);
      const b = sortValue(right);
      const compared =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : collator.compare(String(a), String(b));
      return query.sort.direction === "descending" ? -compared : compared;
    });
  }
  const pageSize = Math.max(1, query.pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
  };
}
