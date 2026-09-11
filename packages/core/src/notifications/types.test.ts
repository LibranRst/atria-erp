import { describe, expect, test } from "bun:test";
import {
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
  notificationDestination,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "./types";

describe("Notification Core Schemas", () => {
  test("registerPushTokenSchema validates valid Expo and Web Push tokens", () => {
    const validExpo = {
      platform: "EXPO_IOS",
      token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    };
    const expoResult = registerPushTokenSchema.safeParse(validExpo);
    expect(expoResult.success).toBe(true);

    const validWeb = {
      platform: "WEB",
      endpoint: "https://fcm.googleapis.com/fcm/send/xxxx",
      p256dh: "BMz_test-key",
      auth: "e3_test-key",
    };
    const webResult = registerPushTokenSchema.safeParse(validWeb);
    expect(webResult.success).toBe(true);
  });

  test("registerPushTokenSchema rejects credentials from the wrong platform", () => {
    expect(
      registerPushTokenSchema.safeParse({
        platform: "EXPO_IOS",
        token: "ExpoPushToken[abc_123]",
        endpoint: "https://push.example.test/device",
      }).success,
    ).toBe(false);
  });

  test("registerPushTokenSchema rejects invalid platform", () => {
    const invalid = {
      platform: "WINDOWS_PHONE",
      token: "xyz",
    };
    const result = registerPushTokenSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test("unregisterPushTokenSchema requires the platform credential", () => {
    expect(
      unregisterPushTokenSchema.safeParse({
        platform: "WEB",
        endpoint: "https://push.example.test/subscription",
      }).success,
    ).toBe(true);
    expect(unregisterPushTokenSchema.safeParse({ platform: "WEB" }).success).toBe(false);
    expect(
      unregisterPushTokenSchema.safeParse({
        platform: "EXPO_ANDROID",
        token: "ExpoPushToken[device]",
      }).success,
    ).toBe(true);
  });

  test("markNotificationReadSchema validates UUID", () => {
    const valid = { id: "11111111-1111-1111-1111-111111111111" };
    expect(markNotificationReadSchema.safeParse(valid).success).toBe(true);

    const invalid = { id: "not-a-uuid" };
    expect(markNotificationReadSchema.safeParse(invalid).success).toBe(false);
  });

  test("markAllNotificationsReadSchema parses optional category", () => {
    expect(markAllNotificationsReadSchema.safeParse({}).success).toBe(true);
    expect(markAllNotificationsReadSchema.safeParse({ category: "ACTION_REQUIRED" }).success).toBe(
      true,
    );
    expect(markAllNotificationsReadSchema.safeParse({ category: "INFORMATIONAL" }).success).toBe(
      true,
    );
    expect(markAllNotificationsReadSchema.safeParse({ category: "OTHER" }).success).toBe(false);
  });

  describe("notificationDestination", () => {
    test("maps change_order with projectId to project rab tab even when actionUrl is /approvals", () => {
      expect(
        notificationDestination({
          referenceType: "change_order",
          projectId: "project-123",
          actionUrl: "/approvals",
        }),
      ).toBe("/projects/project-123?tab=rab");
    });

    test("maps rab with projectId to project rab tab even when actionUrl is /approvals", () => {
      expect(
        notificationDestination({
          referenceType: "rab",
          projectId: "project-456",
          actionUrl: "/approvals",
        }),
      ).toBe("/projects/project-456?tab=rab");
    });

    test("preserves /approvals for financial approvals like project_cost", () => {
      expect(
        notificationDestination({
          referenceType: "project_cost",
          projectId: "project-789",
          actionUrl: "/approvals",
        }),
      ).toBe("/approvals");
    });

    test("preserves standalone routes when no projectId is provided", () => {
      expect(
        notificationDestination({
          referenceType: "change_order",
          actionUrl: "/approvals",
        }),
      ).toBe("/approvals");
    });

    test("returns null for invalid or null actionUrl", () => {
      expect(notificationDestination({ actionUrl: null })).toBe(null);
      expect(notificationDestination({ actionUrl: "javascript:alert(1)" })).toBe(null);
    });
  });
});
