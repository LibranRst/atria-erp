import { expect, test } from "bun:test";
import {
  materialFieldsSchema,
  type MaterialCandidate,
  type MaterialDraftView,
} from "@atria/core/ai/material-import";
import { materialReferenceSuggestions } from "./material-reference-suggestions";

function candidate(overrides: Partial<MaterialCandidate> = {}): MaterialCandidate {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    fields: materialFieldsSchema.parse({
      name: "Panel HPL",
      categoryName: "HPL",
      unit: "lembar",
      locationName: "Gudang utama",
      withoutVendor: true,
    }),
    selected: false,
    materialId: null,
    source: { fileName: "Percakapan", row: 1, raw: "Panel HPL" },
    needsSourceReview: false,
    similarNames: [],
    issues: ["Kategori belum ditemukan atau ambigu."],
    ...overrides,
  };
}
function draft(rows: MaterialCandidate[]): MaterialDraftView {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    revision: 2,
    canCreateVendor: false,
    options: { categories: [], locations: ["Gudang utama"], vendors: [] },
    payload: {
      conversationId: "10000000-0000-4000-8000-000000000002",
      toolCallId: "material-proposal",
      analysisStatus: "READY",
      progress: rows.length,
      error: null,
      appliedCorrections: [],
      receipts: [],
      referenceReceipts: {},
      rows,
    },
  };
}

test("a corrected category can be approved after selecting only ready rows deselects its material", () => {
  expect(materialReferenceSuggestions(draft([candidate()]))).toEqual([
    { kind: "category", name: "HPL", phone: "" },
  ]);
});

test("newly registered references suppress obsolete validation notices", () => {
  const review = draft([candidate({ selected: true })]);
  review.options.categories = [" hpl "];
  expect(materialReferenceSuggestions(review)).toEqual([]);
});

test("repeated pending references need one approval and created materials are excluded", () => {
  const first = candidate({ selected: true });
  expect(
    materialReferenceSuggestions(
      draft([
        first,
        { ...first, id: "other-row", selected: false },
        candidate({ materialId: "created-material" }),
      ]),
    ),
  ).toEqual([{ kind: "category", name: "HPL", phone: "" }]);
});

test("vendor proposals respect vendor permission and the explicit without-vendor choice", () => {
  const row = candidate();
  row.fields.vendorName = "Supplier baru";
  row.fields.withoutVendor = false;
  row.issues.push("Vendor belum ditemukan. Pilih tanpa vendor atau buat vendor sesuai izin.");
  const review = draft([row]);
  expect(materialReferenceSuggestions(review).some((ref) => ref.kind === "vendor")).toBe(false);
  const authorized = { ...review, canCreateVendor: true };
  expect(materialReferenceSuggestions(authorized).some((ref) => ref.kind === "vendor")).toBe(true);
  row.fields.withoutVendor = true;
  expect(materialReferenceSuggestions(authorized).some((ref) => ref.kind === "vendor")).toBe(false);
});
