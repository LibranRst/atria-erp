import { describe, expect, test } from "bun:test";

import { assertRapCategoryReady, assertRapSetupTransition } from "./rap-setup";

describe("guided RAP setup", () => {
  test("allows only sequential stage progression", () => {
    expect(() => assertRapSetupTransition("MATERIAL", "TUKANG")).not.toThrow();
    expect(() => assertRapSetupTransition("TUKANG", "SUBCON")).not.toThrow();
    expect(() => assertRapSetupTransition("MATERIAL", "REVIEW")).toThrow();
  });

  test("requires ready packages or an explicit skip", () => {
    expect(() =>
      assertRapCategoryReady([{ categoryCode: "TUKANG", status: "ACTIVE" }], "TUKANG", false),
    ).not.toThrow();
    expect(() =>
      assertRapCategoryReady([{ categoryCode: "TUKANG", status: "DRAFT" }], "TUKANG", false),
    ).toThrow();
    expect(() => assertRapCategoryReady([], "TUKANG", false)).toThrow();
    expect(() => assertRapCategoryReady([], "TUKANG", true)).not.toThrow();
  });

  test("does not allow skipping a category that still has live packages", () => {
    expect(() =>
      assertRapCategoryReady([{ categoryCode: "SUBCON", status: "ACTIVE" }], "SUBCON", true),
    ).toThrow();
    expect(() =>
      assertRapCategoryReady([{ categoryCode: "SUBCON", status: "CANCELLED" }], "SUBCON", true),
    ).not.toThrow();
  });
});
