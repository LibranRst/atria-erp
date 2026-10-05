import { describe, expect, test } from "bun:test";
import { getWebPushConfiguration, isExpiredWebPushError, isWebPushEndpoint } from "./web-push";

describe("Web Push configuration and outbound endpoints", () => {
  test("does not enable browser activation when sender credentials are incomplete", () => {
    const configured = {
      WEB_PUSH_VAPID_PUBLIC_KEY: " public-key ",
      WEB_PUSH_VAPID_PRIVATE_KEY: " private-key ",
      WEB_PUSH_SUBJECT: " mailto:admin@example.com ",
    };
    expect(getWebPushConfiguration(configured)).toEqual({
      publicKey: "public-key",
      privateKey: "private-key",
      subject: "mailto:admin@example.com",
    });
    for (const key of Object.keys(configured)) {
      expect(getWebPushConfiguration({ ...configured, [key]: " " })).toBeNull();
    }
    expect(getWebPushConfiguration({})).toBeNull();
  });

  test("only permits HTTPS push services, preventing stored arbitrary URLs from making server requests", () => {
    for (const endpoint of [
      "https://web.push.apple.com/device",
      "https://fcm.googleapis.com/wp/device",
      "https://updates.push.services.mozilla.com/wpush/v2/device",
      "https://foo.notify.windows.com/device",
    ])
      expect(isWebPushEndpoint(endpoint)).toBe(true);
    for (const endpoint of [
      "http://web.push.apple.com/device",
      "https://127.0.0.1/device",
      "https://web.push.apple.com.evil.example/device",
      "https://fcm.googleapis.com@127.0.0.1/device",
      "https://fcm.googleapis.com:8443/device",
      "https://example.com/device",
      "invalid",
    ])
      expect(isWebPushEndpoint(endpoint)).toBe(false);
  });

  test("only terminal 404 and 410 responses retire subscriptions", () => {
    expect(isExpiredWebPushError({ statusCode: 404 })).toBe(true);
    expect(isExpiredWebPushError({ statusCode: 410 })).toBe(true);
    expect(isExpiredWebPushError({ statusCode: 503 })).toBe(false);
    expect(isExpiredWebPushError(new Error("offline"))).toBe(false);
  });
});
