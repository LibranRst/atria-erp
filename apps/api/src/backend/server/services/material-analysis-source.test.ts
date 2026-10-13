import { describe, expect, test, spyOn } from "bun:test";
import * as XLSX from "xlsx";
import { spreadsheetMaterialSources, mapMaterialSources } from "./material-analysis-source";
import { documentModel } from "@backend/lib/ai/document-model";
function workbook(counts: readonly number[]): Uint8Array {
  const book = XLSX.utils.book_new();
  counts.forEach((count, sheet) =>
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["Nama", "Satuan", "Harga"],
        ...Array.from({ length: count }, (_, index) => [
          `Material ${sheet}-${index}`,
          "lembar",
          "1.250.000",
        ]),
      ]),
      `Sheet ${sheet + 1}`,
    ),
  );
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}
describe("material spreadsheet ingestion", () => {
  test("20 fully labelled material rows map without a large provider generation", async () => {
    const book = XLSX.utils.book_new();
    const headers = [
      "Nama Material",
      "Kode Material",
      "Kategori",
      "Satuan",
      "Spesifikasi",
      "Merek",
      "Warna",
      "Harga Acuan (Rp)",
      "Minimum Stok",
      "Lokasi",
      "Vendor",
      "Tanpa Vendor",
    ];
    for (const index of [0, 1])
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet([
          headers,
          ...Array.from({ length: 10 }, (_, row) => [
            `MDF ${index}-${row}`,
            `MDF-${index}-${row}`,
            "Papan",
            "lembar",
            "18 mm",
            "Contoh",
            "Putih",
            245000,
            0.75,
            "Gudang UTAMA",
            "",
            "Ya",
          ]),
        ]),
        `Sheet ${index + 1}`,
      );
    const sources = spreadsheetMaterialSources(
      XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
      "catalog.xlsx",
      "/private/catalog",
    );
    const provider = spyOn(documentModel.models, "generateContent").mockImplementation(async () => {
      throw new Error("Provider generation must not be needed for explicit spreadsheet fields");
    });
    try {
      const rows = await mapMaterialSources(
        sources,
        { userRequest: "import semua material masters ini" },
        AbortSignal.timeout(1000),
      );
      expect(rows).toHaveLength(20);
      expect(rows[0].fields).toMatchObject({
        name: "MDF 0-0",
        code: "MDF-0-0",
        categoryName: "Papan",
        unit: "lembar",
        minimumStock: 0.75,
        lastPurchasePrice: 245000,
        withoutVendor: true,
      });
      expect(rows[19].fields.name).toBe("MDF 1-9");
      expect(provider).not.toHaveBeenCalled();
    } finally {
      provider.mockRestore();
    }
  });
  test("mixed structured/model rows keep the original source indexes", async () => {
    const structured = {
      sheet: "Material",
      row: 2,
      raw: `Kolom: ["Nama","Kategori","Satuan","Lokasi","Tanpa Vendor"]\nData: ["MDF","Papan","lembar","Gudang","Ya"]`,
    };
    const unstructured = { row: 1, raw: "Cat putih liter" };
    const provider = spyOn(documentModel.models, "generateContent").mockResolvedValue({
      text: JSON.stringify({
        rows: [
          {
            index: 0,
            fields: {
              name: "Cat",
              categoryName: "Finishing",
              unit: "liter",
              locationName: "Gudang",
              withoutVendor: true,
            },
            uncertain: true,
          },
        ],
      }),
    });
    try {
      const rows = await mapMaterialSources(
        [structured, unstructured],
        {},
        AbortSignal.timeout(1000),
      );
      expect(rows.map((row) => row.index)).toEqual([0, 1]);
      expect(rows[1].fields.name).toBe("Cat");
      expect(rows[1].uncertain).toBe(true);
    } finally {
      provider.mockRestore();
    }
  });
  test("reads all sheets and more than 100 rows without truncation", () => {
    const result = spreadsheetMaterialSources(
      workbook([125, 125, 125, 125]),
      "catalog.xlsx",
      "/private/catalog",
    );
    expect(result).toHaveLength(500);
    expect(result.at(-1)?.sheet).toBe("Sheet 4");
    expect(result.at(-1)?.row).toBe(126);
    expect(result[0].raw).toContain("1.250.000");
  });
  test("501 rejects the complete source instead of taking first 500", () => {
    expect(() =>
      spreadsheetMaterialSources(workbook([501]), "catalog.xlsx", "/private/catalog"),
    ).toThrow("Maksimal 500");
  });
  test("headerless files preserve their first data row", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["MDF", "lembar"],
        ["Cat", "kaleng"],
      ]),
      "Data",
    );
    expect(
      spreadsheetMaterialSources(
        XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
        "catalog.xlsx",
        "/private/catalog",
      ),
    ).toHaveLength(2);
  });
});
