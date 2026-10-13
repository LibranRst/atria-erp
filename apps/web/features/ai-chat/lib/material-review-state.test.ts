import { expect, test } from "bun:test";
import {
  materialFieldsSchema,
  type MaterialCandidate,
  type MaterialDraftView,
} from "@atria/core/ai/material-import";
import {
  materialReviewRows,
  materialReviewState,
  materialReviewFilters,
  materialReviewPrimary,
  materialRowSelection,
} from "./material-review-state";

function row(
  selected = false,
  materialId: string | null = null,
  issues: string[] = [],
): MaterialCandidate {
  return {
    id: crypto.randomUUID(),
    fields: materialFieldsSchema.parse({
      name: "Panel",
      categoryName: "Papan",
      locationName: "Gudang",
      unit: "lembar",
    }),
    selected,
    materialId,
    issues,
    similarNames: [],
    needsSourceReview: false,
    source: { fileName: "Percakapan", row: 1, raw: "Panel" },
  };
}
function draft(
  rows: MaterialCandidate[],
  analysisStatus: MaterialDraftView["payload"]["analysisStatus"] = "READY",
): MaterialDraftView {
  return {
    id: crypto.randomUUID(),
    revision: 1,
    canCreateVendor: false,
    options: { categories: ["Papan"], locations: ["Gudang"], vendors: [] },
    payload: {
      rows,
      analysisStatus,
      conversationId: crypto.randomUUID(),
      toolCallId: "fixture",
      progress: rows.length,
      error: null,
      appliedCorrections: [],
      receipts: [],
      referenceReceipts: {},
    },
  };
}
test("valid, selected and saved remain distinct when nothing is selected", () => {
  const state = materialReviewState(draft([row(), row()]));
  expect([state.valid, state.selected, state.saved]).toEqual([2, 0, 0]);
  expect(state.headline).toBe("Pilih material untuk disimpan");
});
test("toggling one row preserves deferred reference choices and excludes saved records", () => {
  const first = row(true),
    deferred = row(true, null, ["Kategori belum terdaftar"]),
    saved = row(true, crypto.randomUUID());
  expect(materialRowSelection([first, deferred, saved], first.id, false)).toEqual([deferred.id]);
  expect(materialRowSelection([first, deferred, saved], first.id, true)).toEqual([
    first.id,
    deferred.id,
  ]);
});
test("all selected and partial selected explain exactly what the save will affect", () => {
  expect(materialReviewState(draft([row(true), row(true)])).headline).toBe(
    "Semua 2 material dipilih",
  );
  const state = materialReviewState(draft([row(true), row()]));
  expect(state.headline).toBe("1 dari 2 material dipilih");
  expect(state.detail).toContain("1 lainnya tetap di draft");
});
test("partial save keeps unsaved work active and complete requires every row saved", () => {
  const rows = [row(false, "created"), row(true), row(false, null, ["Duplikat nama."])];
  const partial = materialReviewState(draft(rows));
  expect([
    partial.phase,
    partial.remaining,
    partial.selected,
    partial.blocked,
    partial.duplicates,
  ]).toEqual(["review", 2, 1, 1, 1]);
  expect(materialReviewRows(rows, "pending")).toHaveLength(2);
  expect(materialReviewRows(rows, "review")).toHaveLength(1);
  expect(materialReviewRows(rows, "saved")).toHaveLength(1);
  expect(materialReviewState(draft([row(true, "created")])).phase).toBe("complete");
});
test("invalid selected rows never inflate the save count or make an import complete", () => {
  const state = materialReviewState(draft([row(true, null, ["Kategori belum ditemukan."])]));
  expect([state.selected, state.valid, state.blocked, state.phase]).toEqual([0, 0, 1, "review"]);
});
test("analysis, failure, cancellation and empty results have their own state", () => {
  expect(materialReviewState(null).phase).toBe("loading");
  expect(materialReviewState(draft([], "PROCESSING")).phase).toBe("analysing");
  expect(materialReviewState(draft([], "FAILED")).phase).toBe("failed");
  expect(materialReviewState(draft([row(false, "created"), row()], "CANCELLED")).detail).toContain(
    "1 material sudah tersimpan",
  );
  expect(materialReviewState(draft([])).phase).toBe("empty");
});
test("compact primary first selects valid rows and saves only an explicit selection", () => {
  expect(materialReviewPrimary(materialReviewState(draft([row(), row()])))).toBe("select");
  expect(materialReviewPrimary(materialReviewState(draft([row(true), row()])))).toBe("save");
  expect(
    materialReviewPrimary(
      materialReviewState(draft([row(true, null, ["Kategori belum ditemukan."])])),
    ),
  ).toBe("none");
});
test("filters appear only when they separate meaningful sets of material", () => {
  expect(materialReviewFilters(materialReviewState(draft([row(true)])))).toEqual(["pending"]);
  expect(
    materialReviewFilters(
      materialReviewState(draft([row(), row(false, null, ["Periksa sumber"])])),
    ),
  ).toEqual(["pending", "review"]);
  expect(materialReviewFilters(materialReviewState(draft([row(), row(false, "created")])))).toEqual(
    ["pending", "saved"],
  );
});
test("a historical cancellation cannot imply already saved materials were cancelled", () => {
  const state = materialReviewState(draft([row(false, "created")], "CANCELLED"));
  expect(state.phase).toBe("complete");
  expect(materialReviewPrimary(state)).toBe("none");
});
test("a retry delay is visible as waiting rather than silently appearing active", () => {
  const review = draft([], "PROCESSING");
  review.payload.error = "Pemetaan AI melewati batas waktu.";
  const state = materialReviewState(review);
  expect(state.headline).toBe("Analisis dijadwalkan ulang");
  expect(state.badge).toBe("Menunggu");
  expect(state.detail).toContain("dicoba ulang otomatis");
});
