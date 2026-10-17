import { describe, expect, test } from "bun:test";
import type { DesktopTableColumn } from "./desktop-table";
import { desktopTablePage } from "./use-desktop-table";

type Row = { readonly id: string; readonly name: string; readonly amount: number };
const rowKey = (row: Row): string => row.id;
const columns: readonly DesktopTableColumn<Row>[] = [
  { key: "name", label: "Nama", render: (row) => row.name, sortValue: (row) => row.name },
  { key: "amount", label: "Nominal", render: (row) => row.amount, sortValue: (row) => row.amount },
];
const source: readonly Row[] = Array.from({ length: 27 }, (_, index) => ({
  id: `row-${index + 1}`,
  name: `Pengeluaran ${index + 1}`,
  amount: (index + 1) * 100 + 0.25,
}));

describe("Shared desktop full-result table pages", () => {
  test("sorts the whole authorized result before selecting each page", () => {
    const sort = { column: "amount", direction: "descending" } satisfies Parameters<
      typeof desktopTablePage<Row>
    >[3];
    expect(desktopTablePage(source, columns, rowKey, sort, 1, 10).rows[0]?.amount).toBe(2700.25);
    const last = desktopTablePage(source, columns, rowKey, sort, 3, 10);
    expect(last.total).toBe(27);
    expect(last.rows.map((row) => row.amount)).toEqual(
      source
        .slice(0, 7)
        .reverse()
        .map((row) => row.amount),
    );
    expect(source[0]?.id).toBe("row-1");
  });
  test("orders names naturally and ties deterministically", () => {
    const tied: readonly Row[] = [
      { id: "row-11", name: "Pengeluaran 2", amount: 0 },
      { id: "row-2", name: "Pengeluaran 2", amount: 0 },
      { id: "row-1", name: "Pengeluaran 1", amount: 0 },
    ];
    const result = desktopTablePage(
      tied,
      columns,
      rowKey,
      { column: "name", direction: "ascending" },
      1,
      10,
    );
    expect(result.rows.map(rowKey)).toEqual(["row-1", "row-2", "row-11"]);
  });
  test("returns truthful totals and remaining 25/50-row pages", () => {
    const sort = { column: "name", direction: "ascending" } satisfies Parameters<
      typeof desktopTablePage<Row>
    >[3];
    expect(desktopTablePage(source, columns, rowKey, sort, 2, 25).rows).toHaveLength(2);
    expect(desktopTablePage(source, columns, rowKey, sort, 1, 50).rows).toHaveLength(27);
  });
  test("clamps stale pages and keeps a zero-result collection empty", () => {
    const sort = { column: "name", direction: "ascending" } satisfies Parameters<
      typeof desktopTablePage<Row>
    >[3];
    expect(desktopTablePage(source.slice(0, 3), columns, rowKey, sort, 3, 10)).toEqual({
      rows: source.slice(0, 3),
      total: 3,
      page: 1,
    });
    expect(desktopTablePage([], columns, rowKey, sort, 3, 10)).toEqual({
      rows: [],
      total: 0,
      page: 1,
    });
  });
});
