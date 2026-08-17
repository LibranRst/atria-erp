import { describe, expect, test } from "bun:test";

import { formatIdr, formatShortIdr, formatTightIdr } from "./money";

describe("formatIdr", () => {
  test("menulis nilai penuh dengan pemisah ribuan id-ID", () => {
    expect(formatIdr(1_200_000_000)).toBe("Rp 1.200.000.000");
    expect(formatIdr(0)).toBe("Rp 0");
  });
});

describe("formatShortIdr", () => {
  test("meringkas ke jt dan M dengan presisi normal", () => {
    expect(formatShortIdr(40_700_000)).toBe("Rp 40,7 jt");
    expect(formatShortIdr(1_039_300_000)).toBe("Rp 1,04 M");
    expect(formatShortIdr(-144_000_000)).toBe("-Rp 144 jt");
  });
});

describe("formatTightIdr", () => {
  test("meringkas lebih agresif untuk sel metrik sempit", () => {
    expect(formatTightIdr(115_560_000_000)).toBe("Rp 115,6 M");
    expect(formatTightIdr(250_400_000)).toBe("Rp 250 jt");
    expect(formatTightIdr(-19_440_500)).toBe("-Rp 19 jt");
    expect(formatTightIdr(750_000)).toBe("Rp 750 rb");
    expect(formatTightIdr(0)).toBe("Rp 0");
  });

  test("naik satuan sebelum menghasilkan string yang lebih panjang", () => {
    // 999,5 jt harus menjadi "Rp 1 M", bukan "Rp 1.000 jt".
    expect(formatTightIdr(999_500_000)).toBe("Rp 1 M");
    expect(formatTightIdr(999_600)).toBe("Rp 1 jt");
  });

  test("tidak pernah melebihi 10 karakter untuk nilai operasional", () => {
    const samples = [0, 1_500, 999_499, 999_500, 45_000_000, 999_400_000, 128_400_000_000];
    for (const sample of samples) {
      expect(formatTightIdr(sample).length).toBeLessThanOrEqual(10);
      expect(formatTightIdr(-sample).length).toBeLessThanOrEqual(11);
    }
  });
});
