import type { NotificationEnvironment } from "./notification-store";
import { createNotificationActivity, type ActivityTimers } from "./notification-activity";

export type NotificationSource = {
  listen: (name: string, listener: (event: Event) => void) => void;
  onOpen: (listener: () => void) => void;
  onError: (listener: () => void) => void;
  close: () => void;
};
export type NotificationBrowserRuntime = {
  available: () => boolean;
  connect: (url: string) => NotificationSource | null;
  listen: (
    target: "window" | "document",
    event: string,
    listener: () => void,
    capture?: boolean,
  ) => () => void;
  timers: ActivityTimers<number>;
  now: () => number;
};

const browser: NotificationBrowserRuntime = {
  available: (): boolean => navigator.onLine && document.visibilityState === "visible",
  connect: (url: string): NotificationSource | null => {
    if (typeof EventSource === "undefined") return null;
    const source = new EventSource(url, { withCredentials: true });
    return {
      listen: (name, listener) => source.addEventListener(name, listener),
      onOpen: (listener) => {
        source.onopen = listener;
      },
      onError: (listener) => {
        source.onerror = listener;
      },
      close: () => source.close(),
    };
  },
  listen: (target, event, listener, capture = false) => {
    const owner = target === "window" ? window : document;
    owner.addEventListener(event, listener, { capture, passive: true });
    return () => owner.removeEventListener(event, listener, { capture });
  },
  timers: {
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: (handle) => window.clearTimeout(handle),
  },
  now: () => Date.now(),
};

function signature(event: Event): string | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(event.data);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "signature" in parsed &&
      typeof parsed.signature === "string"
    ) {
      return parsed.signature;
    }
  } catch {
    return null;
  }
  return null;
}

/** Owns stream health, user inactivity, and browser listeners; store owns private data. */
export function createNotificationEnvironment(
  reportError: (message: string) => void,
  runtime: NotificationBrowserRuntime = browser,
): NotificationEnvironment {
  let idle = false;
  let healthy = false;
  return {
    available: () => runtime.available() && !idle,
    streamHealthy: () => healthy,
    scheduleRefresh: (callback, delay) => {
      const handle = runtime.timers.schedule(callback, delay);
      return () => runtime.timers.cancel(handle);
    },
    reportError,
    subscribe: (resume) => {
      idle = false;
      let source: NotificationSource | null = null;
      let lastCursor = "";
      let lastSignature = "";
      let lastErrorRefreshAt = 0;
      let expectedRotationUntil = 0;
      const available = (): boolean => runtime.available() && !idle;
      const closeStream = (): void => {
        source?.close();
        source = null;
        healthy = false;
      };
      const openStream = (): void => {
        if (source || !available()) return;
        const cursor = lastCursor ? `?cursor=${encodeURIComponent(lastCursor)}` : "";
        const opened = runtime.connect(`/api/notifications/stream${cursor}`);
        if (!opened) return;
        source = opened;
        opened.onOpen(() => {
          if (source === opened && available()) healthy = true;
        });
        opened.listen("invalidate", (event) => {
          if (source !== opened || !available()) return;
          if (event instanceof MessageEvent && event.lastEventId) lastCursor = event.lastEventId;
          resume();
        });
        opened.listen("session", (event) => {
          if (source !== opened || !available()) return;
          const next = signature(event);
          if (!next) return;
          if (lastSignature && next !== lastSignature) resume();
          lastSignature = next;
        });
        opened.listen("rotate", () => {
          if (source === opened) expectedRotationUntil = runtime.now() + 5_000;
        });
        opened.onError(() => {
          if (source !== opened) return;
          healthy = false;
          if (!available()) {
            closeStream();
            return;
          }
          const now = runtime.now();
          if (now < expectedRotationUntil) return;
          if (now - lastErrorRefreshAt >= 30_000) {
            lastErrorRefreshAt = now;
            resume();
          }
        });
      };
      const resumeAndConnect = (): void => {
        if (!available()) {
          closeStream();
          return;
        }
        openStream();
        resume();
      };
      const activity = createNotificationActivity(
        runtime.timers,
        () => {
          idle = true;
          closeStream();
        },
        () => {
          idle = false;
          resumeAndConnect();
        },
      );
      const interact = (): void => {
        if (runtime.available()) activity.touch();
      };
      const returnToPage = (): void => {
        if (!runtime.available()) {
          closeStream();
          return;
        }
        if (!activity.touch()) resumeAndConnect();
      };
      activity.start();
      openStream();
      const stopListeners = [
        runtime.listen("window", "online", resumeAndConnect),
        runtime.listen("window", "offline", closeStream),
        runtime.listen("window", "focus", returnToPage),
        runtime.listen("document", "visibilitychange", returnToPage),
        runtime.listen("window", "pointerdown", interact),
        runtime.listen("window", "keydown", interact),
        runtime.listen("window", "touchstart", interact),
        runtime.listen("window", "scroll", interact, true),
      ];
      return () => {
        activity.stop();
        closeStream();
        stopListeners.forEach((stop) => stop());
      };
    },
  };
}
