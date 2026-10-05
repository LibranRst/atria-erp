/**
 * Pembatas laju sederhana per pengguna, disimpan di memori proses.
 *
 * Cukup untuk melindungi dari klik beruntun dan skrip iseng pada deployment
 * satu instance. Jika nanti aplikasi berjalan multi-instance, pindahkan
 * penghitungnya ke penyimpanan bersama.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;

type WindowState = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, WindowState>();

export type RateLimitResult = {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
};

export function checkRateLimit(userId: string, now = Date.now()): RateLimitResult {
  const existing = windows.get(userId);

  if (!existing || now >= existing.resetAt) {
    windows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Hanya dipakai oleh test untuk mengisolasi state antar kasus. */
export function resetRateLimits(): void {
  windows.clear();
}
