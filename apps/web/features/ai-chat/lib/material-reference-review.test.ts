import { expect, test } from "bun:test";
import { reconcileReferenceReview, referenceReviewError } from "./material-reference-review";

test("reference review preserves names and deliberate exclusions when reopened", () => {
  const previous = reconcileReferenceReview(
    [
      { kind: "category", name: "Kayu", phone: "" },
      { kind: "location", name: "Gudang", phone: "" },
    ],
    [],
  );
  const edited = previous.map((entry, index) =>
    index
      ? { ...entry, selected: false }
      : { ...entry, reference: { ...entry.reference, name: "Kayu Olahan" } },
  );
  const reopened = reconcileReferenceReview(
    [
      { kind: "category", name: " KAYU ", phone: "" },
      { kind: "location", name: "Gudang", phone: "" },
    ],
    edited,
  );
  expect(reopened[0].reference.name).toBe("Kayu Olahan");
  expect(reopened[1].selected).toBe(false);
});
test("approved references disappear and newly proposed references are reviewable", () => {
  const previous = reconcileReferenceReview([{ kind: "category", name: "Kayu", phone: "" }], []);
  const next = reconcileReferenceReview(
    [{ kind: "location", name: "Gudang Baru", phone: "" }],
    previous,
  );
  expect(next.map((entry) => entry.sourceName)).toEqual(["Gudang Baru"]);
});
test("only selected references require valid names and vendor phone", () => {
  const entries = reconcileReferenceReview(
    [{ kind: "vendor", name: "Vendor Baru", phone: "" }],
    [],
  );
  expect(referenceReviewError(entries)).toContain("telepon");
  expect(
    referenceReviewError([
      { ...entries[0], reference: { ...entries[0].reference, phone: "081234567890" } },
    ]),
  ).toBeUndefined();
  expect(referenceReviewError([{ ...entries[0], selected: false }])).toContain("Pilih");
});
