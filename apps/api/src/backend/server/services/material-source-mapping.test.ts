import { expect, test } from "bun:test";
import type { MaterialSource } from "@atria/core/ai/material-import";
import {
  structuredMaterialSource,
  materialSourceChunk,
  hasMaterialFieldInstructions,
  mappedStructuredMaterialSource,
  textTableMaterialSources,
  normalizedTextMaterialSources,
} from "./material-source-mapping";

test("pipe/TSV material tables preserve physical provenance, all candidates and Indonesian reference prices", () => {
  const text =
    "Pratinjau material\nNama | Satuan | Kategori | Lokasi | Vendor | Harga referensi\nPanel QA | lembar | | | Tanpa vendor | Rp 125.000\nSekrup QA | pak | Hardware | Gudang | Tanpa vendor | Rp 35.000\nLem QA | botol | Finishing | Gudang | Tanpa vendor | Rp 45.000\nCatatan di luar tabel.";
  const rows = textTableMaterialSources(text, "qa.txt", "private://qa");
  expect(rows?.map((row) => row.row)).toEqual([3, 4, 5]);
  expect(rows?.map((row) => structuredMaterialSource(row)?.fields.lastPurchasePrice)).toEqual([
    125000, 35000, 45000,
  ]);
  expect(rows?.map((row) => structuredMaterialSource(row)?.fields.withoutVendor)).toEqual([
    true,
    true,
    true,
  ]);
  expect(structuredMaterialSource(rows?.[0] ?? { row: 0, raw: "" })?.fields.categoryName).toBe("");
  expect(rows?.[0].raw).toContain("Panel QA ");
  expect(
    textTableMaterialSources(text.replace(/[ ]*\|[ ]*/g, "\t"), "qa.txt", "private://qa"),
  ).toHaveLength(3);
  expect(
    textTableMaterialSources(
      text.replace(
        "Sekrup QA | pak | Hardware | Gudang | Tanpa vendor | Rp 35.000",
        "Sekrup QA | pak | Hardware",
      ),
      "qa.txt",
      "private://qa",
    ),
  ).toBeNull();
});
test("text analysis-only requests remain deterministic while real field overrides still require interpretation", () => {
  const context = {
    userRequest:
      "Analisis tiga material sebagai draft Material Master. Semua tanpa vendor. Harga memakai format rupiah Indonesia. Kategori dan lokasi belum saya pastikan; beri pilihan dari referensi yang ada, jangan buat referensi baru atau menyimpan material otomatis.",
  };
  expect(hasMaterialFieldInstructions(context)).toBe(false);
  expect(mappedStructuredMaterialSource(source(), context)?.fields.withoutVendor).toBe(true);
  expect(mappedStructuredMaterialSource(source(), context)?.fields.vendorName).toBe("");
  expect(
    hasMaterialFieldInstructions({
      userRequest: "Gunakan kategori Hardware dan lokasi Workshop untuk semua material",
    }),
  ).toBe(true);
  expect(hasMaterialFieldInstructions({ userRequest: "Ubah harga menjadi Rp 250.000" })).toBe(true);
  expect(hasMaterialFieldInstructions({ userRequest: "Semua tanpa vendor kecuali Panel QA" })).toBe(
    true,
  );
  expect(mappedStructuredMaterialSource(source(), { userRequest: "Ganti kategori" })).toBeNull();
});
test("unprocessed legacy text checkpoints are upgraded once without duplicating structured sources", () => {
  const lines = [
    "Header dokumen",
    "Nama|Kategori|Satuan|Lokasi|Harga",
    "Panel QA|Panel|lembar|Gudang|1000",
    "Lem QA|Finishing|botol|Gudang|2000",
  ];
  const legacy = lines.map((raw, index) => ({
    attachmentUrl: "private://qa",
    fileName: "qa.txt",
    row: index + 1,
    raw,
  }));
  const converted = normalizedTextMaterialSources(legacy);
  expect(converted).toHaveLength(2);
  expect(converted.map((row) => row.row)).toEqual([3, 4]);
  expect(normalizedTextMaterialSources(converted)).toEqual(converted);
});
test("exactly500 structured text candidates keep their header outside the candidate limit", () => {
  const header = "Nama|Kategori|Satuan|Lokasi";
  const rows = Array.from({ length: 500 }, (_, index) => `Panel ${index}|Panel|lembar|Gudang`).join(
    "\n",
  );
  expect(textTableMaterialSources(`${header}\n${rows}`, "qa.txt", "private://qa")).toHaveLength(
    500,
  );
  expect(
    textTableMaterialSources(
      `${header}\n${rows}\nPanel 501|Panel|lembar|Gudang`,
      "qa.txt",
      "private://qa",
    ),
  ).toHaveLength(501);
});

function source(
  price: string | number = "Rp 1.250.000,50",
  minimum: string | number = 0.75,
): MaterialSource {
  return {
    fileName: "catalog.xlsx",
    sheet: "Material A",
    row: 2,
    raw: `Kolom: ${JSON.stringify(["Nama Material", "Kategori", "Satuan", "Lokasi", "Harga Acuan (Rp)", "Minimum Stok", "Tanpa Vendor", "Kuantitas"])}\nData: ${JSON.stringify(["MDF", "Papan", "lembar", "Gudang UTAMA", price, minimum, "Ya", 100])}`,
  };
}
test("structured values preserve local currency and fractional minimum without using physical quantity", () => {
  const parsed = structuredMaterialSource(source());
  expect(parsed?.fields).toMatchObject({
    lastPurchasePrice: 1250000.5,
    minimumStock: 0.75,
    withoutVendor: true,
  });
  expect(parsed?.uncertain).toBe(false);
  expect(structuredMaterialSource(source("Rp 245,000.00"))?.fields.lastPurchasePrice).toBe(245000);
});
test("invalid or ambiguous numbers require source review rather than invented values", () => {
  expect(structuredMaterialSource(source("harga tidak terbaca"))?.uncertain).toBe(true);
  expect(structuredMaterialSource(source(245000, "1.250"))?.uncertain).toBe(true);
  expect(structuredMaterialSource(source(-1))?.fields.lastPurchasePrice).toBe(0);
});
test("field instructions continue through the AI interpretation path", () => {
  expect(hasMaterialFieldInstructions({ userRequest: "import semua material" })).toBe(false);
  expect(
    hasMaterialFieldInstructions({ userRequest: "Gunakan kategori Hardware dan tanpa vendor" }),
  ).toBe(true);
  expect(
    materialSourceChunk(
      Array.from({ length: 20 }, () => source()),
      { userRequest: "Ganti kategori" },
    ),
  ).toHaveLength(5);
});
test("checkpoints keep 20 structured or five model rows and never exceed 32k characters", () => {
  expect(
    materialSourceChunk(
      Array.from({ length: 30 }, () => source()),
      {},
    ),
  ).toHaveLength(20);
  const unknown = { fileName: "image.png", row: 1, raw: "MDF 18mm lembar" };
  expect(
    materialSourceChunk(
      Array.from({ length: 20 }, () => unknown),
      {},
    ),
  ).toHaveLength(5);
  expect(
    materialSourceChunk(
      [
        { ...unknown, raw: "a".repeat(20000) },
        { ...unknown, raw: "b".repeat(20000) },
      ],
      {},
    ),
  ).toHaveLength(1);
  expect(() => materialSourceChunk([{ ...unknown, raw: "a".repeat(32001) }], {})).toThrow(
    "terlalu panjang",
  );
});
