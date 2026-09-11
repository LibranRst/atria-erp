import { describe, expect, test } from "bun:test";
import { formatRelativeTime, getSeverityVisualConfig } from "./utils/notification-formatting";

describe("notification-formatting", () => {
  test("formatRelativeTime formats recent dates correctly", () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe("Baru saja");

    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe("5 mnt lalu");

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe("2 jam lalu");

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(yesterday.toISOString())).toBe("Kemarin");
  });

  test("getSeverityVisualConfig returns correct colors and icons", () => {
    const resolved = getSeverityVisualConfig("CRITICAL", true);
    expect(resolved.iconName).toBe("check_circle");
    expect(resolved.badgeTone).toBe("positive");

    const critical = getSeverityVisualConfig("CRITICAL", false);
    expect(critical.iconName).toBe("alert_circle");
    expect(critical.badgeTone).toBe("critical");

    const warning = getSeverityVisualConfig("WARNING", false);
    expect(warning.iconName).toBe("alert_circle");
    expect(warning.badgeTone).toBe("warning");

    const info = getSeverityVisualConfig("INFO", false);
    expect(info.iconName).toBe("info");
    expect(info.badgeTone).toBe("info");
  });
});
