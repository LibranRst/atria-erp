import { describe, expect, test } from "bun:test";
import { aiPreferenceInputSchema, DEFAULT_AI_PREFERENCE } from "./ai-preference";

describe("AI preference validation", () => {
  test("menerima seluruh default canonical", () => {
    expect(aiPreferenceInputSchema.parse(DEFAULT_AI_PREFERENCE)).toEqual(DEFAULT_AI_PREFERENCE);
  });

  test("merapikan catatan kosong dan membatasi 300 karakter", () => {
    expect(
      aiPreferenceInputSchema.parse({
        responseStyle: "VERY_CONCISE",
        primaryFocus: "BUDGET_MARGIN",
        customNote: "   ",
      }).customNote,
    ).toBeNull();
    expect(
      aiPreferenceInputSchema.safeParse({
        responseStyle: "DETAILED",
        primaryFocus: "AUTO",
        customNote: "x".repeat(301),
      }).success,
    ).toBe(false);
  });
});
