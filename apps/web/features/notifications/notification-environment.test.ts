import { describe, expect, test } from "bun:test";
import {
  createNotificationEnvironment,
  type NotificationBrowserRuntime,
  type NotificationSource,
} from "./hooks/notification-environment";
import { createNotificationStore, type NotificationTransport } from "./hooks/notification-store";

class Source implements NotificationSource {
  closed = false;
  opened: () => void = () => undefined;
  failed: () => void = () => undefined;
  readonly handlers = new Map<string, (event: Event) => void>();
  listen(name: string, listener: (event: Event) => void): void {
    this.handlers.set(name, listener);
  }
  onOpen(listener: () => void): void {
    this.opened = listener;
  }
  onError(listener: () => void): void {
    this.failed = listener;
  }
  close(): void {
    this.closed = true;
  }
  emit(name: string, data: string): void {
    this.handlers.get(name)?.(new MessageEvent(name, { data }));
  }
}

function harness(): {
  runtime: NotificationBrowserRuntime;
  sources: Source[];
  advance: (milliseconds: number) => void;
  emit: (target: "window" | "document", event: string) => void;
  setAvailable: (available: boolean) => void;
  pending: () => number;
  listeners: () => number;
} {
  let now = 1_000_000;
  let available = true;
  let id = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  const listeners = new Map<string, Set<() => void>>();
  const sources: Source[] = [];
  return {
    sources,
    runtime: {
      available: () => available,
      now: () => now,
      connect: () => {
        const source = new Source();
        sources.push(source);
        return source;
      },
      listen: (target, event, listener) => {
        const key = `${target}:${event}`;
        const items = listeners.get(key) ?? new Set<() => void>();
        items.add(listener);
        listeners.set(key, items);
        return () => {
          items.delete(listener);
        };
      },
      timers: {
        schedule: (callback, delay) => {
          const handle = ++id;
          timers.set(handle, { due: now + delay, callback });
          return handle;
        },
        cancel: (handle) => {
          timers.delete(handle);
        },
      },
    },
    advance: (milliseconds) => {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].due;
        next[1].callback();
      }
      now = target;
    },
    emit: (target, event) => {
      listeners.get(`${target}:${event}`)?.forEach((listener) => listener());
    },
    setAvailable: (value) => {
      available = value;
    },
    pending: () => timers.size,
    listeners: () => [...listeners.values()].reduce((total, items) => total + items.size, 0),
  };
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

function transport(): {
  api: NotificationTransport;
  calls: () => number;
  reject: (value: boolean) => void;
} {
  let calls = 0;
  let reject = false;
  return {
    calls: () => calls,
    reject: (value) => {
      reject = value;
    },
    api: {
      summary: async () => {
        calls += 1;
        if (reject)
          return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "offline" } };
        return {
          success: true,
          data: { unreadCount: 0, actionRequiredCount: 0, informationalUnreadCount: 0, items: [] },
        };
      },
      list: async () => ({ success: true, data: { items: [], hasMore: false, nextCursor: null } }),
      mark: async () => ({ success: true, data: { success: true } }),
      markAll: async () => ({ success: true, data: { success: true } }),
    },
  };
}

describe("notification browser lifecycle", () => {
  test("healthy SSE suppresses timed full refresh; idle closes source and interaction refreshes", async () => {
    const time = harness();
    const api = transport();
    const store = createNotificationStore(
      api.api,
      createNotificationEnvironment(() => undefined, time.runtime),
    );
    const stop = store.start();
    try {
      await settle();
      time.sources[0].opened();
      time.advance(120_000);
      await settle();
      expect(api.calls()).toBe(1);
      time.advance(180_000);
      await settle();
      expect(time.sources[0].closed).toBe(true);
      time.advance(120_000);
      await settle();
      expect(api.calls()).toBe(1);
      time.emit("window", "pointerdown");
      await settle();
      expect(time.sources).toHaveLength(2);
      expect(api.calls()).toBe(2);
    } finally {
      stop();
    }
    expect(time.pending()).toBe(0);
    expect(time.listeners()).toBe(0);
  });

  test("fallback remains available after stream failure and recovers failed state even when stream reopens", async () => {
    const time = harness();
    const api = transport();
    const store = createNotificationStore(
      api.api,
      createNotificationEnvironment(() => undefined, time.runtime),
    );
    const stop = store.start();
    try {
      await settle();
      time.sources[0].opened();
      api.reject(true);
      time.sources[0].failed();
      await settle();
      expect(store.snapshot().error).not.toBeNull();
      api.reject(false);
      time.sources[0].opened();
      time.advance(120_000);
      await settle();
      expect(api.calls()).toBe(3);
      expect(store.snapshot().error).toBeNull();
    } finally {
      stop();
    }
  });

  test("background visibility stops the stream; returning refreshes immediately", async () => {
    const time = harness();
    const api = transport();
    const store = createNotificationStore(
      api.api,
      createNotificationEnvironment(() => undefined, time.runtime),
    );
    const stop = store.start();
    try {
      await settle();
      time.setAvailable(false);
      time.emit("document", "visibilitychange");
      expect(time.sources[0].closed).toBe(true);
      time.advance(300_000);
      await settle();
      expect(api.calls()).toBe(1);
      time.setAvailable(true);
      time.emit("document", "visibilitychange");
      await settle();
      expect(api.calls()).toBe(2);
      expect(time.sources).toHaveLength(2);
    } finally {
      stop();
    }
  });

  test("session changes and invalidations force refresh despite healthy stream; disposed sources cannot refresh", async () => {
    const time = harness();
    const api = transport();
    const store = createNotificationStore(
      api.api,
      createNotificationEnvironment(() => undefined, time.runtime),
    );
    const stop = store.start();
    await settle();
    const source = time.sources[0];
    source.opened();
    source.emit("session", JSON.stringify({ signature: "owner-permissions" }));
    source.emit("session", JSON.stringify({ signature: "revoked-permissions" }));
    await settle();
    expect(api.calls()).toBe(2);
    source.emit("invalidate", "{}");
    await settle();
    expect(api.calls()).toBe(3);
    stop();
    source.emit("invalidate", "{}");
    source.opened();
    await settle();
    expect(api.calls()).toBe(3);
    expect(time.pending()).toBe(0);
  });
});
