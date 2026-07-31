import { describe, expect, test } from "bun:test";

import {
  DASHBOARD_AUTO_REFRESH_AFTER_MS,
  DASHBOARD_REFRESH_COOLDOWN_MS,
  shouldAutoRefreshDashboard,
} from "./use-dashboard-refresh";

const generatedAt = "2026-07-27T00:00:00.000Z";

describe("dashboard passive refresh policy", () => {
  test("does not revalidate a fresh snapshot", () => {
    expect(
      shouldAutoRefreshDashboard({
        generatedAt,
        currentTime: new Date(
          new Date(generatedAt).getTime() + DASHBOARD_AUTO_REFRESH_AFTER_MS - 1,
        ),
        lastAttemptAt: null,
      }),
    ).toBe(false);
  });

  test("revalidates once the snapshot reaches the passive refresh age", () => {
    expect(
      shouldAutoRefreshDashboard({
        generatedAt,
        currentTime: new Date(new Date(generatedAt).getTime() + DASHBOARD_AUTO_REFRESH_AFTER_MS),
        lastAttemptAt: null,
      }),
    ).toBe(true);
  });

  test("suppresses duplicate focus and visibility attempts during cooldown", () => {
    const currentTime = new Date(new Date(generatedAt).getTime() + DASHBOARD_AUTO_REFRESH_AFTER_MS);
    expect(
      shouldAutoRefreshDashboard({
        generatedAt,
        currentTime,
        lastAttemptAt: currentTime.getTime() - DASHBOARD_REFRESH_COOLDOWN_MS + 1,
      }),
    ).toBe(false);
  });

  test("allows another passive attempt after cooldown", () => {
    const currentTime = new Date(new Date(generatedAt).getTime() + DASHBOARD_AUTO_REFRESH_AFTER_MS);
    expect(
      shouldAutoRefreshDashboard({
        generatedAt,
        currentTime,
        lastAttemptAt: currentTime.getTime() - DASHBOARD_REFRESH_COOLDOWN_MS,
      }),
    ).toBe(true);
  });
});
