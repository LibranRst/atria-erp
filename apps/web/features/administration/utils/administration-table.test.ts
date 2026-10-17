import { describe, expect, test } from "bun:test";
import type { DesktopTableColumn } from "@/components/ui";
import { getAdministrationTablePage, type AdministrationTableQuery } from "./administration-table";

type Row = {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly users: number;
};
const rows: readonly Row[] = Array.from({ length: 31 }, (_, index): Row => ({
  id: `row-${index + 1}`,
  name: `Tim ${31 - index}`,
  active: index % 2 === 0,
  users: index + 1,
}));
const columns: readonly DesktopTableColumn<Row>[] = [
  {
    key: "name",
    label: "Tim",
    render: (row: Row): string => row.name,
    sortValue: (row: Row): string => row.name,
  },
  {
    key: "users",
    label: "Pengguna",
    render: (row: Row): number => row.users,
    sortValue: (row: Row): number => row.users,
  },
];
const searchText = (row: Row): string => row.name;
const filter = (row: Row, value: string): boolean => value !== "active" || row.active;
function query(
  overrides: Partial<AdministrationTableQuery<Row>> = {},
): AdministrationTableQuery<Row> {
  return {
    search: "",
    filter: "all",
    page: 1,
    pageSize: 10,
    sort: { column: "name", direction: "ascending" },
    ...overrides,
  };
}

describe("Complete administration collections", () => {
  test("sorts the complete collection before choosing a page", (): void => {
    const first = getAdministrationTablePage(rows, query(), columns, searchText, filter);
    const second = getAdministrationTablePage(
      rows,
      query({ page: 2 }),
      columns,
      searchText,
      filter,
    );
    expect(first.rows.map((row) => row.name)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Tim ${index + 1}`),
    );
    expect(second.rows.map((row) => row.name)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Tim ${index + 11}`),
    );
    expect(first.total).toBe(31);
    expect(second.total).toBe(31);
  });
  test("combines normalized search and active filter without losing the result total", (): void => {
    const page = getAdministrationTablePage(
      rows,
      query({ search: " TIM 1 ", filter: "active", pageSize: 10 }),
      columns,
      searchText,
      filter,
    );
    expect(page.total).toBe(6);
    expect(page.rows.map((row) => row.name)).toEqual([
      "Tim 1",
      "Tim 11",
      "Tim 13",
      "Tim 15",
      "Tim 17",
      "Tim 19",
    ]);
  });
  test("numeric descending sort spans pages and supports the larger page sizes", (): void => {
    const page = getAdministrationTablePage(
      rows,
      query({ sort: { column: "users", direction: "descending" }, pageSize: 25 }),
      columns,
      searchText,
      filter,
    );
    expect(page.rows[0]?.users).toBe(31);
    expect(page.rows.at(-1)?.users).toBe(7);
    expect(page.rows).toHaveLength(25);
    const all = getAdministrationTablePage(
      rows,
      query({ pageSize: 50 }),
      columns,
      searchText,
      filter,
    );
    expect(all.rows).toHaveLength(31);
  });
  test("clamps the page after collection changes and keeps empty results distinct from a full page", (): void => {
    const last = getAdministrationTablePage(rows, query({ page: 12 }), columns, searchText, filter);
    expect(last.page).toBe(4);
    expect(last.rows).toHaveLength(1);
    const empty = getAdministrationTablePage(
      rows,
      query({ search: "tidak ada", page: 4 }),
      columns,
      searchText,
      filter,
    );
    expect(empty).toEqual({ rows: [], total: 0, page: 1 });
    expect(rows[0]?.name).toBe("Tim 31");
  });
});
