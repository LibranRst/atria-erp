import { describe, expect, test } from "bun:test";
import { isNotificationActive, INFORMATIONAL_READ_RETENTION_MS } from "./retention";
import { dueStage } from "./events";
import { safeNotificationUrl, registerPushTokenSchema } from "./types";
const now = new Date("2026-09-05T10:00:00Z");
const old = new Date("2020-01-01T00:00:00Z");
describe("notification lifecycle", () => {
  test("reading never resolves an open action", () => {
    expect(
      isNotificationActive(
        { category: "ACTION_REQUIRED", read: true, isResolved: false, createdAt: old },
        now,
      ),
    ).toBe(true);
  });
  test("unread information never expires", () => {
    expect(
      isNotificationActive(
        { category: "INFORMATIONAL", read: false, isResolved: false, createdAt: old },
        now,
      ),
    ).toBe(true);
  });
  for (const category of ["INFORMATIONAL", "ACTION_REQUIRED"] as const) {
    test(`${category} retains exact 30 day boundary, expires one millisecond later`, () => {
      const boundary = new Date(now.getTime() - INFORMATIONAL_READ_RETENTION_MS);
      const item = {
        category,
        read: true,
        isResolved: true,
        readAt: boundary,
        resolvedAt: boundary,
        createdAt: old,
      };
      expect(isNotificationActive(item, now)).toBe(true);
      expect(isNotificationActive(item, new Date(now.getTime() + 1))).toBe(false);
    });
  }
  test("information retention starts when old information is read", () => {
    expect(
      isNotificationActive(
        { category: "INFORMATIONAL", read: true, readAt: now, isResolved: false, createdAt: old },
        now,
      ),
    ).toBe(true);
  });
  test("legacy timestamps fall back to creation", () => {
    expect(
      isNotificationActive(
        { category: "INFORMATIONAL", read: true, isResolved: false, createdAt: old },
        now,
      ),
    ).toBe(false);
  });
});
describe("Jakarta due dates", () => {
  test("H-3, H-4, due and overdue boundaries", () => {
    expect(dueStage(new Date("2026-09-08T12:00:00Z"), 1, now)).toBe("UPCOMING");
    expect(dueStage(new Date("2026-09-09T12:00:00Z"), 1, now)).toBe(null);
    expect(dueStage(now, 1, now)).toBe("DUE");
    expect(dueStage(old, 1, now)).toBe("OVERDUE");
  });
  test("midnight Jakarta, not UTC, changes the due stage", () => {
    const date = new Date("2026-09-05T00:00:00+07:00");
    expect(dueStage(date, 1, new Date("2026-09-04T16:59:59Z"))).toBe("UPCOMING");
    expect(dueStage(date, 1, new Date("2026-09-04T17:00:00Z"))).toBe("DUE");
  });
  test("partial payment remains actionable; fully settled is closed", () => {
    expect(dueStage(now, 500, now)).toBe("DUE");
    expect(dueStage(now, 0, now)).toBe(null);
    expect(dueStage(now, -1, now)).toBe(null);
  });
});
describe("safe destinations and subscriptions", () => {
  test("only internal business routes are accepted", () => {
    for (const url of [
      "https://evil.test",
      "//evil.test",
      "javascript:alert(1)",
      "/\\evil.test",
      "/projects\n",
      "/login",
    ])
      expect(safeNotificationUrl(url)).toBe(null);
    expect(safeNotificationUrl("/projects/123?tab=budget")).toBe("/projects/123?tab=budget");
    expect(safeNotificationUrl("/reconciliation")).toBe("/reconciliation");
  });
  test("platform-specific credentials are required", () => {
    expect(registerPushTokenSchema.safeParse({ platform: "EXPO_IOS" }).success).toBe(false);
    expect(
      registerPushTokenSchema.safeParse({ platform: "EXPO_ANDROID", token: "garbage" }).success,
    ).toBe(false);
    expect(
      registerPushTokenSchema.safeParse({ platform: "WEB", endpoint: "http://example.test" })
        .success,
    ).toBe(false);
  });
});
