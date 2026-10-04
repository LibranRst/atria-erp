import { describe, expect, test } from "bun:test";
import { resolveMobileNotificationRoute } from "./notification-route";

describe("tujuan notifikasi sesuai ketersediaan native", () => {
  test("dashboard mempertahankan tab", () => {
    expect(resolveMobileNotificationRoute("/ledger?tab=budget", "/projects")).toEqual({
      kind: "native",
      href: { pathname: "/ledger", params: { tab: "budget" } },
    });
  });
  test("detail Proyek yang belum native mempertahankan konteks melalui web", () => {
    expect(resolveMobileNotificationRoute("/projects/abc?tab=stok", "/ledger")).toEqual({
      kind: "web",
      path: "/projects/abc?tab=stok",
    });
    expect(resolveMobileNotificationRoute("/projects/abc", "/ledger")).toEqual({
      kind: "native",
      href: { pathname: "/projects/[projectId]", params: { projectId: "abc" } },
    });
  });
  test("tujuan material, filter biaya dan rekonsiliasi tidak dibuang", () => {
    for (const path of [
      "/materials/opening",
      "/expenses?filter=NEEDS_VERIFICATION",
      "/reconciliation",
      "/notifications",
    ]) {
      expect(resolveMobileNotificationRoute(path, "/ledger")).toEqual({ kind: "web", path });
    }
  });
  test("URL tidak aman tetap memakai rute cadangan", () => {
    for (const path of [
      null,
      "https://evil.invalid/ledger",
      "//evil.invalid/projects",
      "/api/trpc",
    ]) {
      expect(resolveMobileNotificationRoute(path, "/expenses")).toEqual({
        kind: "native",
        href: { pathname: "/expenses" },
      });
    }
  });
});
