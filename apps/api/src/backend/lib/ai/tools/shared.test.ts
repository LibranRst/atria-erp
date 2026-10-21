import { daysUntil, money, toNumber } from "@backend/lib/ai/tools/shared";
import { describe, expect, it } from "bun:test";

describe("konversi angka numeric Postgres", () => {
  it("membaca string numeric menjadi angka", () => {
    expect(toNumber("1080000.00")).toBe(1080000);
  });

  it("memperlakukan null dan nilai tak terbaca sebagai nol", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber("bukan angka")).toBe(0);
  });
});

describe("penyajian nilai uang untuk model", () => {
  it("mengembalikan angka bulat dan bentuk terformat sekaligus", () => {
    // Model dilarang menghitung uang sendiri, jadi kedua bentuk selalu disediakan.
    const value = money("343000000.00");
    expect(value.amount).toBe(343000000);
    expect(value.formatted).toContain("343");
  });

  it("mempertahankan sen pada DTO dan nominal yang dikutip model", () => {
    expect(money("125000000.25")).toEqual({ amount: 125000000.25, formatted: "Rp 125.000.000,25" });
    expect(money("1000.60")).toEqual({ amount: 1000.6, formatted: "Rp 1.000,60" });
    expect(money("-1000.25")).toEqual({ amount: -1000.25, formatted: "Rp -1.000,25" });
    expect(money(null)).toEqual({ amount: 0, formatted: "Rp 0" });
  });

  it("mempertahankan tanda negatif untuk kategori yang minus", () => {
    expect(money("-89000000.00").amount).toBe(-89000000);
  });
});

describe("hitungan hari menuju jatuh tempo", () => {
  const now = new Date("2026-08-14T15:00:00Z");

  it("menganggap tanggal yang sama sebagai nol hari, apa pun jamnya", () => {
    expect(daysUntil(new Date("2026-08-14T01:00:00Z"), now)).toBe(0);
    expect(daysUntil(new Date("2026-08-14T23:00:00Z"), now)).toBe(0);
  });

  it("mengembalikan angka positif untuk tanggal mendatang", () => {
    expect(daysUntil(new Date("2026-08-21T00:00:00Z"), now)).toBe(7);
  });

  it("mengembalikan angka negatif untuk tagihan yang sudah lewat", () => {
    expect(daysUntil(new Date("2026-08-11T00:00:00Z"), now)).toBe(-3);
  });
});
