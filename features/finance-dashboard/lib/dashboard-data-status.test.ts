import { describe, expect, test } from "bun:test";

import { resolveDashboardDataStatus } from "./dashboard-data-status";

const generatedAt = "2026-07-15T00:00:00.000Z";

describe("dashboard data status", () => {
  test("hides fresh data without leaving a status", () => {
    expect(resolveDashboardDataStatus({
      generatedAt,
      currentTime: new Date("2026-07-15T00:14:59.000Z"),
      partial: false,
      unavailableSources: [],
      refreshing: false,
    })).toBeNull();
  });

  test("shows a compact stale status at the fifteen minute boundary", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      currentTime: new Date("2026-07-15T00:15:00.000Z"),
      partial: false,
      unavailableSources: [],
      refreshing: false,
    });

    expect(status?.kind).toBe("STALE");
    expect(status?.label).toBe("Belum diperbarui · 07.00");
  });

  test("prioritizes partial data and keeps unavailable sources accessible", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      currentTime: new Date("2026-07-15T00:30:00.000Z"),
      partial: true,
      unavailableSources: ["Persetujuan", "Material"],
      refreshing: false,
    });

    expect(status?.kind).toBe("PARTIAL");
    expect(status?.label).toBe("Data sebagian");
    expect(status?.accessibleLabel).toContain("Persetujuan, Material");
  });

  test("uses one pending label while refreshing", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      currentTime: new Date("2026-07-15T00:15:00.000Z"),
      partial: false,
      unavailableSources: [],
      refreshing: true,
    });

    expect(status?.label).toBe("Memperbarui…");
    expect(status?.accessibleLabel).toBe("Memperbarui data Dashboard");
  });
});
