import { isFallbackWorthyError } from "@/lib/ai/providers";
import { describe, expect, it } from "bun:test";

describe("klasifikasi kegagalan penyedia AI", () => {
  it("berpindah ke penyedia cadangan saat kredit habis atau kena rate limit", () => {
    expect(isFallbackWorthyError({ statusCode: 402 })).toBe(true);
    expect(isFallbackWorthyError({ statusCode: 429 })).toBe(true);
  });

  it("berpindah saat otentikasi ditolak, karena API key bisa saja dicabut", () => {
    expect(isFallbackWorthyError({ statusCode: 401 })).toBe(true);
    expect(isFallbackWorthyError({ statusCode: 403 })).toBe(true);
  });

  it("berpindah saat penyedia mengalami gangguan sisi server", () => {
    expect(isFallbackWorthyError({ statusCode: 500 })).toBe(true);
    expect(isFallbackWorthyError({ status: 503 })).toBe(true);
  });

  it("tidak berpindah saat kesalahan berasal dari input kita sendiri", () => {
    // Penyedia lain akan menolak permintaan yang sama, jadi mencoba ulang hanya
    // membuang waktu dan menunda pesan kesalahan ke pengguna.
    expect(isFallbackWorthyError({ statusCode: 400 })).toBe(false);
    expect(isFallbackWorthyError({ statusCode: 404 })).toBe(false);
    expect(isFallbackWorthyError({ statusCode: 422 })).toBe(false);
  });

  it("berpindah saat kegagalan jaringan tidak membawa kode status", () => {
    expect(isFallbackWorthyError(new Error("fetch failed"))).toBe(true);
    expect(isFallbackWorthyError(null)).toBe(true);
  });
});
