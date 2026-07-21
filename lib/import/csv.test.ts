import { describe, expect, test } from "bun:test";

import { parseCsvTable } from "./csv";

describe("parseCsvTable", () => {
  test("reads headers and rows", () => {
    const parsed = parseCsvTable("name,location,quantity\nMultipleks,Gudang,10\n");
    expect(parsed.headers).toEqual(["name", "location", "quantity"]);
    expect(parsed.rows).toEqual([["Multipleks", "Gudang", "10"]]);
  });

  test("supports commas, escaped quotes, and newlines inside quoted fields", () => {
    const parsed = parseCsvTable('name,note\n"Multipleks, 18mm","Hasil ""stock opname""\nGudang"');
    expect(parsed.rows[0]).toEqual(["Multipleks, 18mm", 'Hasil "stock opname"\nGudang']);
  });

  test("rejects an unclosed quoted field", () => {
    expect(() => parseCsvTable('name\n"Multipleks')).toThrow("belum ditutup");
  });
});
