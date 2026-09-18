import { describe, expect, test } from "bun:test";
import { resolveMobileNotificationRoute } from "./notification-route";

describe("tujuan notifikasi native", () => {
  test("setiap tujuan yang benar-benar dikirim server mendarat di rute native yang ada", () => {
    // Daftar ini adalah keluaran nyata `notificationDestination` (@atria/core) —
    // lihat docs/plans/2026-09-12-native-notification-banner-reliability.md.
    const destinations = [
      "/approvals",
      "/expenses?filter=NEEDS_VERIFICATION",
      "/ledger",
      "/materials",
      "/materials/opening",
      "/notifications",
      "/reconciliation",
      "/projects/8d1f1e6e-1111-4111-8111-111111111111",
      "/projects/8d1f1e6e-1111-4111-8111-111111111111?tab=budget",
    ] as const;
    const known = new Set([
      "/approvals",
      "/expenses",
      "/ledger",
      "/materials",
      "/projects",
      "/projects/8d1f1e6e-1111-4111-8111-111111111111",
    ]);
    for (const destination of destinations) {
      const route = resolveMobileNotificationRoute(destination, "/projects");
      expect(known.has(route)).toBe(true);
    }
  });

  test("tab proyek dibuang tetapi proyeknya tetap terbuka", () => {
    expect(resolveMobileNotificationRoute("/projects/abc?tab=stok", "/ledger")).toBe(
      "/projects/abc",
    );
    expect(resolveMobileNotificationRoute("/projects/abc#top", "/ledger")).toBe("/projects/abc");
    expect(resolveMobileNotificationRoute("/projects", "/ledger")).toBe("/projects");
  });

  test("halaman turunan material dan filter biaya tetap memakai layar induknya", () => {
    expect(resolveMobileNotificationRoute("/materials/opening", "/ledger")).toBe("/materials");
    expect(resolveMobileNotificationRoute("/expenses?filter=NEEDS_VERIFICATION", "/ledger")).toBe(
      "/expenses",
    );
  });

  test("rekonsiliasi jatuh ke dashboard finance, bukan layar tak dikenal", () => {
    expect(resolveMobileNotificationRoute("/reconciliation", "/ledger")).toBe("/ledger");
  });

  test("tujuan asing dan URL tidak aman memakai rute cadangan peran", () => {
    expect(resolveMobileNotificationRoute("/notifications", "/projects")).toBe("/projects");
    expect(resolveMobileNotificationRoute("/settings/materials", "/materials")).toBe("/materials");
    expect(resolveMobileNotificationRoute(null, "/expenses")).toBe("/expenses");
    expect(resolveMobileNotificationRoute("//evil.test/ledger", "/projects")).toBe("/projects");
    expect(resolveMobileNotificationRoute("https://evil.test/ledger", "/projects")).toBe(
      "/projects",
    );
  });
});
