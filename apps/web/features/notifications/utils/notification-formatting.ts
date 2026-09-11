import type { NotificationSeverity } from "@atria/core/notifications/types";

/**
 * Memformat tanggal ISO menjadi waktu relatif dalam Bahasa Indonesia.
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return "Baru saja";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} mnt lalu`;
  }
  if (diffHours < 24) {
    return `${diffHours} jam lalu`;
  }
  if (diffDays === 1) {
    return `Kemarin`;
  }
  if (diffDays < 7) {
    return `${diffDays} hari lalu`;
  }

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export type SeverityVisualConfig = {
  iconName: "alert_circle" | "info" | "check_circle" | "bell";
  iconClass: string;
  badgeTone: "critical" | "warning" | "info" | "neutral" | "positive";
  bgClass: string;
};

export function getSeverityVisualConfig(
  severity: NotificationSeverity,
  isResolved: boolean,
): SeverityVisualConfig {
  if (isResolved) {
    return {
      iconName: "check_circle",
      iconClass: "text-on-surface-variant",
      badgeTone: "positive",
      bgClass: "bg-surface-container-high",
    };
  }

  switch (severity) {
    case "CRITICAL":
      return {
        iconName: "alert_circle",
        iconClass: "text-critical",
        badgeTone: "critical",
        bgClass: "bg-critical/10",
      };
    case "WARNING":
      return {
        iconName: "alert_circle",
        iconClass: "text-accent",
        badgeTone: "warning",
        bgClass: "bg-accent/10",
      };
    case "INFO":
    default:
      return {
        iconName: "info",
        iconClass: "text-on-surface-variant",
        badgeTone: "info",
        bgClass: "bg-surface-container-high",
      };
  }
}
