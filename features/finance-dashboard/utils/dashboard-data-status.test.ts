import { describe, expect, test } from "bun:test";

import { resolveDashboardDataStatus } from "./dashboard-data-status";

const generatedAt = "2026-07-15T00:00:00.000Z";

describe("dashboard data status", () => {
  test("hides healthy data without leaving a refresh control", () => {
    expect(
      resolveDashboardDataStatus({
        generatedAt,
        partial: false,
        unavailableSources: [],
        online: true,
        refreshFailed: false,
        refreshing: false,
      }),
    ).toBeNull();
  });

  test("shows unavailable sources visually and accessibly for partial data", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      partial: true,
      unavailableSources: ["Persetujuan", "Material"],
      online: true,
      refreshFailed: false,
      refreshing: false,
    });

    expect(status?.kind).toBe("PARTIAL");
    expect(status?.title).toBe("Sebagian data belum termuat");
    expect(status?.description).toContain("Persetujuan, Material");
    expect(status?.accessibleLabel).toContain("Persetujuan, Material");
    expect(status?.retryable).toBe(true);
  });

  test("keeps the partial state visible while retrying", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      partial: true,
      unavailableSources: ["Material"],
      online: true,
      refreshFailed: false,
      refreshing: true,
    });

    expect(status?.title).toBe("Memperbarui data…");
    expect(status?.accessibleLabel).toBe("Memperbarui data Dashboard yang belum lengkap");
  });

  test("prioritizes offline recovery over a partial-source retry", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      partial: true,
      unavailableSources: ["Material"],
      online: false,
      refreshFailed: true,
      refreshing: false,
    });

    expect(status?.kind).toBe("OFFLINE");
    expect(status?.description).toContain("07.00");
    expect(status?.retryable).toBe(false);
  });

  test("offers retry only after a refresh attempt failed", () => {
    const status = resolveDashboardDataStatus({
      generatedAt,
      partial: false,
      unavailableSources: [],
      online: true,
      refreshFailed: true,
      refreshing: false,
    });

    expect(status?.kind).toBe("REFRESH_FAILED");
    expect(status?.title).toBe("Data belum berhasil diperbarui");
    expect(status?.retryable).toBe(true);
  });
});
