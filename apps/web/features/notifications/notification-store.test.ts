import { describe, expect, test } from "bun:test";
import { createNotificationStore, type NotificationTransport } from "./hooks/notification-store";
import type { NotificationItem, NotificationSummary } from "@atria/core/notifications/types";
const item: NotificationItem = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant",
  userId: "user",
  title: "Biaya",
  message: "Verifikasi biaya",
  read: false,
  severity: "INFO",
  category: "ACTION_REQUIRED",
  isResolved: false,
  createdAt: "2026-09-05T00:00:00Z",
};
const summary: NotificationSummary = {
  unreadCount: 120,
  actionRequiredCount: 100,
  informationalUnreadCount: 30,
  items: [],
};
function transport(): NotificationTransport {
  return {
    summary: async () => ({ success: true, data: summary }),
    list: async ({ category }) => ({
      success: true,
      data: {
        items: category === "ACTION_REQUIRED" ? [item] : [],
        hasMore: false,
        nextCursor: null,
      },
    }),
    mark: async () => ({ success: true, data: { success: true } }),
    markAll: async () => ({ success: true, data: { success: true } }),
  };
}
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
function setup(
  api: NotificationTransport,
  available = true,
): {
  store: ReturnType<typeof createNotificationStore>;
  stop: () => void;
  errors: string[];
  triggerResume: () => void;
} {
  const errors: string[] = [];
  let resumeListener: (() => void) | undefined;
  const store = createNotificationStore(api, {
    available: () => available,
    subscribe: (resume) => {
      resumeListener = resume;
      return () => {
        resumeListener = undefined;
      };
    },
    reportError: (message) => {
      errors.push(message);
    },
  });
  return {
    store,
    stop: store.start(),
    errors,
    triggerResume: () => resumeListener?.(),
  };
}
describe("notification store", () => {
  test("mark-all uses global count and never resolves open actions", async () => {
    const api = transport();
    let complete: (() => void) | undefined;
    api.markAll = () =>
      new Promise((resolve) => {
        complete = () => resolve({ success: true, data: { success: true } });
      });
    const { store, stop } = setup(api);
    try {
      await settle();
      const pending = store.markAllAsRead("ACTION_REQUIRED");
      expect(store.snapshot().summary.unreadCount).toBe(30);
      expect(store.snapshot().summary.actionRequiredCount).toBe(100);
      complete?.();
      await pending;
    } finally {
      stop();
    }
  });
  test("server rejection rolls back and reports failure", async () => {
    const api = transport();
    api.mark = async () => ({ success: false, error: { code: "FORBIDDEN", message: "Ditolak" } });
    const { store, stop, errors } = setup(api);
    try {
      await settle();
      await store.markAsRead(item.id);
      expect(store.snapshot().pages.ACTION_REQUIRED.items[0].read).toBe(false);
      expect(errors).toEqual(["Ditolak"]);
    } finally {
      stop();
    }
  });
  test("hidden/offline sessions make no request", async () => {
    const api = transport();
    let requests = 0;
    api.summary = async () => {
      requests += 1;
      return { success: true, data: summary };
    };
    const { store, stop } = setup(api, false);
    try {
      await settle();
      await store.refresh();
      expect(requests).toBe(0);
    } finally {
      stop();
    }
  });
  test("concurrent refreshes deduplicate and disposed responses cannot publish", async () => {
    const api = transport();
    let requests = 0;
    let complete: (() => void) | undefined;
    api.summary = () => {
      requests += 1;
      return new Promise((resolve) => {
        complete = () => resolve({ success: true, data: summary });
      });
    };
    const { store, stop } = setup(api);
    await store.refresh();
    await store.refresh();
    expect(requests).toBe(1);
    stop();
    complete?.();
    await settle();
    expect(store.snapshot().summary.unreadCount).toBe(0);
  });
  test("lost authorization clears private data", async () => {
    const api = transport();
    const { store, stop } = setup(api);
    try {
      await settle();
      api.summary = async () => ({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi berakhir" },
      });
      await store.refresh();
      expect(store.snapshot().pages.ACTION_REQUIRED.items).toEqual([]);
      expect(store.snapshot().summary.unreadCount).toBe(0);
    } finally {
      stop();
    }
  });
  test("stream invalidations refresh once while concurrent signals are deduplicated", async () => {
    const api = transport();
    let requests = 0;
    api.summary = async () => {
      requests += 1;
      return { success: true, data: summary };
    };
    const { stop, triggerResume } = setup(api);
    try {
      await settle();
      expect(requests).toBe(1);
      triggerResume();
      triggerResume();
      await settle();
      expect(requests).toBe(2);
    } finally {
      stop();
    }
  });
});
