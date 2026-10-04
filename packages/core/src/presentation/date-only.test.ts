import { describe, expect, test } from "bun:test";
import { clampDateOnly, formatDateOnly, parseDateOnly } from "./date-only";
describe("date-only calendar values", () => {
  test("round trips a selected local day without converting through UTC", () => {
    const date = parseDateOnly("2026-10-03");
    expect(date?.getHours()).toBe(12);
    expect(date && formatDateOnly(date)).toBe("2026-10-03");
  });
  test("rejects invalid dates and permits leap day", () => {
    for (const invalid of ["2026-02-29", "2026-13-03", "2026-00-01", "", "03/10/2026"])
      expect(parseDateOnly(invalid)).toBeNull();
    expect(parseDateOnly("2028-02-29")).not.toBeNull();
  });
  test("clamps only validated date-only bounds", () => {
    expect(clampDateOnly("2026-01-01", "2026-02-01")).toBe("2026-02-01");
    expect(clampDateOnly("2026-12-01", undefined, "2026-10-03")).toBe("2026-10-03");
    expect(clampDateOnly("2026-10-03", "bad")).toBe("2026-10-03");
    expect(clampDateOnly("invalid")).toBe("");
  });
});
