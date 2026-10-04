import { checkRateLimit, resetRateLimits } from "@backend/lib/ai/rate-limit";
import { beforeEach, describe, expect, it } from "bun:test";

describe("pembatas laju AI chat", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("mengizinkan permintaan selama masih di bawah batas jendela", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      expect(checkRateLimit("user-a", now).allowed).toBe(true);
    }
  });

  it("menolak permintaan ke-16 dalam satu menit dan memberi tahu jeda tunggu", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      checkRateLimit("user-a", now);
    }

    const blocked = checkRateLimit("user-a", now + 1_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("membuka kembali setelah jendela satu menit lewat", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      checkRateLimit("user-a", now);
    }

    expect(checkRateLimit("user-a", now + 60_001).allowed).toBe(true);
  });

  it("menghitung kuota terpisah untuk tiap pengguna", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      checkRateLimit("user-a", now);
    }

    expect(checkRateLimit("user-b", now).allowed).toBe(true);
  });
});
