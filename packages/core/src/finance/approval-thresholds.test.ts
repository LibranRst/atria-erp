import { describe, expect, test } from "bun:test";

import {
  DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS,
  parseThresholdCents,
  thresholdCentsToRupiah,
} from "./approval-thresholds";

describe("ambang persetujuan", () => {
  test("nilai seed setara Rp5.000.000", () => {
    expect(thresholdCentsToRupiah(DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS)).toBe(5_000_000);
  });

  test("konversi sen mempertahankan batas pecahan rupiah", () => {
    expect(thresholdCentsToRupiah(10_050n)).toBe(100.5);
    expect(100.49 >= thresholdCentsToRupiah(10_050n)).toBe(false);
    expect(100.5 >= thresholdCentsToRupiah(10_050n)).toBe(true);
  });

  test("nol adalah ambang yang sah, bukan kegagalan", () => {
    // Artinya "semua pencairan butuh persetujuan Owner".
    expect(parseThresholdCents("0")).toBe(BigInt(0));
  });

  test("nilai rusak dikembalikan sebagai null supaya pemanggil memakai seed", () => {
    for (const broken of ["", "  ", "abc", "-1", "1.5", "1e6", null, undefined]) {
      expect(parseThresholdCents(broken)).toBeNull();
    }
  });

  test("nilai valid dibaca apa adanya, termasuk yang sangat besar", () => {
    expect(parseThresholdCents(" 500000000 ")).toBe(BigInt(500_000_000));
    expect(parseThresholdCents("9007199254740993000")).toBe(BigInt("9007199254740993000"));
  });
});
