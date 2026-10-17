import { describe, expect, test } from "bun:test";
import type { DesktopTableColumn } from "@/components/ui";
import { settingsTablePageRows } from "./use-settings-table-state";

type ReferenceRow = { readonly name: string; readonly amount: number };
const columns: readonly DesktopTableColumn<ReferenceRow>[] = [
  { key: "name", label: "Nama", render: (row) => row.name, sortValue: (row) => row.name },
  { key: "amount", label: "Nilai", render: (row) => row.amount, sortValue: (row) => row.amount },
];
const source: readonly ReferenceRow[] = Array.from({ length: 27 }, (_, index) => ({
  name: `Referensi ${index + 1}`,
  amount: (index + 1) * 100 + 0.25,
}));

describe("Settings full-list table pages", () => {
  test("sorts all results before selecting the first and later pages", () => {
    const first = settingsTablePageRows(source, columns, {
      page: 1,
      pageSize: 10,
      sortDescriptor: { column: "amount", direction: "descending" },
    });
    const third = settingsTablePageRows(source, columns, {
      page: 3,
      pageSize: 10,
      sortDescriptor: { column: "amount", direction: "descending" },
    });
    expect(first.map((row) => row.amount)).toEqual(
      source
        .slice(17)
        .reverse()
        .map((row) => row.amount),
    );
    expect(third.map((row) => row.amount)).toEqual(
      source
        .slice(0, 7)
        .reverse()
        .map((row) => row.amount),
    );
    expect(source[0]?.name).toBe("Referensi 1");
  });

  test("orders names naturally and preserves fractional stored amounts", () => {
    const result = settingsTablePageRows([source[10]!, source[1]!, source[0]!], columns, {
      page: 1,
      pageSize: 10,
      sortDescriptor: { column: "name", direction: "ascending" },
    });
    expect(result.map((row) => row.name)).toEqual(["Referensi 1", "Referensi 2", "Referensi 11"]);
    expect(result[0]?.amount).toBe(100.25);
  });

  test("returns true remaining results for 25 and 50 row pages", () => {
    expect(
      settingsTablePageRows(source, columns, {
        page: 2,
        pageSize: 25,
        sortDescriptor: { column: "name", direction: "ascending" },
      }),
    ).toHaveLength(2);
    expect(
      settingsTablePageRows(source, columns, {
        page: 1,
        pageSize: 50,
        sortDescriptor: { column: "name", direction: "ascending" },
      }),
    ).toHaveLength(27);
  });

  test("clamps a stale page after a source shrinks and keeps an empty source empty", () => {
    expect(
      settingsTablePageRows(source.slice(0, 3), columns, {
        page: 3,
        pageSize: 10,
        sortDescriptor: { column: "name", direction: "ascending" },
      }),
    ).toHaveLength(3);
    expect(
      settingsTablePageRows([], columns, {
        page: 3,
        pageSize: 10,
        sortDescriptor: { column: "name", direction: "ascending" },
      }),
    ).toEqual([]);
  });
});
