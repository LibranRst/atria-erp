import { describe, expect, test } from "bun:test";
import {
  applyMaterialBulkCorrections,
  materialCandidateSchema,
  materialBulkCorrectionSchema,
} from "./material-import";
const row = materialCandidateSchema.parse({
  id: crypto.randomUUID(),
  fields: { name: "MDF", unit: "lembar" },
  source: { row: 2, raw: "MDF / lembar / harga [?]" },
  issues: [],
  selected: true,
  needsSourceReview: true,
});
describe("material batch corrections", () => {
  test("common defaults apply to 500 rows without erasing identity or source review", () => {
    const rows = Array.from({ length: 500 }, () => ({ ...row, id: crypto.randomUUID() }));
    const correction = materialBulkCorrectionSchema.parse({
      fields: { locationName: "Gudang utama", categoryName: "Papan" },
    });
    const result = applyMaterialBulkCorrections(rows, [correction]);
    expect(result).toHaveLength(500);
    expect(result[499].fields.locationName).toBe("Gudang utama");
    expect(result[499].fields.name).toBe("MDF");
    expect(result[499].needsSourceReview).toBe(true);
    expect(result[499].source).toEqual(row.source);
    expect(rows[0].fields.locationName).toBe("");
  });
  test("selecting a subset never acknowledges uncertain sources or changes created rows", () => {
    const created = { ...row, id: crypto.randomUUID(), materialId: crypto.randomUUID() };
    const result = applyMaterialBulkCorrections(
      [row, created],
      [materialBulkCorrectionSchema.parse({ fields: {}, selected: false })],
    );
    expect(result[0].selected).toBe(false);
    expect(result[0].needsSourceReview).toBe(true);
    expect(result[1]).toEqual(created);
    expect(() =>
      applyMaterialBulkCorrections(
        [row],
        [
          materialBulkCorrectionSchema.parse({
            rowIds: [crypto.randomUUID()],
            fields: { unit: "unit" },
          }),
        ],
      ),
    ).toThrow();
  });
});
