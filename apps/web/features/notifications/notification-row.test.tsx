import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
  }),
}));

mock.module("./hooks/notification-context", () => ({
  useNotifications: () => ({
    openNotification: async () => ({ success: true, data: { url: "/projects/1" } }),
  }),
}));

import { NotificationRow } from "./components/notification-row";
import type { NotificationItem } from "@atria/core/notifications/types";

const baseItem: NotificationItem = {
  id: "notif-1",
  tenantId: "tenant-1",
  userId: "user-1",
  title: "Proyek selesai",
  message: "Penutupan proyek telah dicatat oleh sistem.",
  read: false,
  severity: "INFO",
  category: "INFORMATIONAL",
  isResolved: false,
  createdAt: new Date().toISOString(),
};

describe("NotificationRow", () => {
  test("renders unread state with unread indicator dot and soft accent background", () => {
    const html = renderToStaticMarkup(<NotificationRow item={baseItem} />);

    expect(html).toContain("Proyek selesai");
    expect(html).toContain("Penutupan proyek telah dicatat oleh sistem.");
    expect(html).toContain("Baru saja");
    expect(html).toContain('aria-label="Belum dibaca"');
    expect(html).toContain("bg-primary/[0.025]");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("h-8.5 w-8.5");
    // Informational & unresolved should NOT render status badges
    expect(html).not.toContain("Perlu Tindakan");
    expect(html).not.toContain("Sudah Selesai");
  });

  test("renders read state without unread dot and with subdued styling", () => {
    const readItem: NotificationItem = {
      ...baseItem,
      read: true,
    };
    const html = renderToStaticMarkup(<NotificationRow item={readItem} />);

    expect(html).toContain("Proyek selesai");
    expect(html).not.toContain('aria-label="Belum dibaca"');
    expect(html).not.toContain("bg-primary/[0.025]");
    expect(html).toContain("text-on-surface-variant");
  });

  test("renders 'Perlu Tindakan' badge when category is ACTION_REQUIRED and unresolved", () => {
    const actionItem: NotificationItem = {
      ...baseItem,
      title: "Biaya menunggu persetujuan",
      category: "ACTION_REQUIRED",
      severity: "WARNING",
      isResolved: false,
    };
    const html = renderToStaticMarkup(<NotificationRow item={actionItem} />);

    expect(html).toContain("Biaya menunggu persetujuan");
    expect(html).toContain("Perlu Tindakan");
    expect(html).not.toContain("Sudah Selesai");
  });

  test("renders 'Sudah Selesai' badge when item is resolved", () => {
    const resolvedItem: NotificationItem = {
      ...baseItem,
      title: "Pembayaran selesai",
      isResolved: true,
      category: "ACTION_REQUIRED",
    };
    const html = renderToStaticMarkup(<NotificationRow item={resolvedItem} />);

    expect(html).toContain("Pembayaran selesai");
    expect(html).toContain("Sudah Selesai");
    expect(html).not.toContain("Perlu Tindakan");
  });
});
