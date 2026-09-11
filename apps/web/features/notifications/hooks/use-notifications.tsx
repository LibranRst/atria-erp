"use client";
import React, { useEffect, useMemo } from "react";
import { openNotificationAction } from "@/app/actions/notifications/open-notification";
import { authClient } from "@/lib/auth-client";
import { getNotificationsAction } from "@/app/actions/notifications/get-notifications";
import { listNotificationsAction } from "@/app/actions/notifications/list-notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications/mark-read";
import { toast } from "sonner";

import { NotificationContext } from "./notification-context";
import { createNotificationStore } from "./notification-store";
function createStore(): ReturnType<typeof createNotificationStore> {
  return createNotificationStore(
    {
      open: openNotificationAction,
      summary: getNotificationsAction,
      list: listNotificationsAction,
      mark: markNotificationReadAction,
      markAll: markAllNotificationsReadAction,
    },
    {
      available: () => navigator.onLine && document.visibilityState === "visible",
      reportError: (message) => {
        toast.error(message);
      },
      subscribe: (resume) => {
        let source: EventSource | null = null;
        let lastCursor = "";
        let lastSessionSignature = "";
        let lastErrorRefreshAt = 0;
        let expectedRotationUntil = 0;

        const closeStream = (): void => {
          source?.close();
          source = null;
        };
        const streamAvailable = (): boolean =>
          navigator.onLine && document.visibilityState === "visible";
        const parseSignature = (event: Event): string | null => {
          if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;
          try {
            const parsed: unknown = JSON.parse(event.data);
            if (
              typeof parsed === "object" &&
              parsed !== null &&
              "signature" in parsed &&
              typeof parsed.signature === "string"
            )
              return parsed.signature;
          } catch {
            return null;
          }
          return null;
        };
        const openStream = (): void => {
          if (source || !streamAvailable() || typeof EventSource === "undefined") return;
          const cursor = lastCursor ? `?cursor=${encodeURIComponent(lastCursor)}` : "";
          source = new EventSource(`/api/notifications/stream${cursor}`, {
            withCredentials: true,
          });
          source.addEventListener("invalidate", (event) => {
            if (event instanceof MessageEvent && event.lastEventId) {
              lastCursor = event.lastEventId;
            }
            resume();
          });
          source.addEventListener("session", (event) => {
            const signature = parseSignature(event);
            if (!signature) return;
            if (lastSessionSignature && signature !== lastSessionSignature) resume();
            lastSessionSignature = signature;
          });
          source.addEventListener("rotate", () => {
            expectedRotationUntil = Date.now() + 5_000;
          });
          source.onerror = () => {
            if (!streamAvailable()) {
              closeStream();
              return;
            }
            const now = Date.now();
            if (now < expectedRotationUntil) return;
            if (now - lastErrorRefreshAt >= 30_000) {
              lastErrorRefreshAt = now;
              resume();
            }
          };
        };
        const resumeAndConnect = (): void => {
          if (!streamAvailable()) {
            closeStream();
            return;
          }
          openStream();
          resume();
        };

        openStream();
        window.addEventListener("online", resumeAndConnect);
        window.addEventListener("offline", closeStream);
        window.addEventListener("focus", resumeAndConnect);
        document.addEventListener("visibilitychange", resumeAndConnect);
        return () => {
          closeStream();
          window.removeEventListener("online", resumeAndConnect);
          window.removeEventListener("offline", closeStream);
          window.removeEventListener("focus", resumeAndConnect);
          document.removeEventListener("visibilitychange", resumeAndConnect);
        };
      },
    },
  );
}
function SessionStore({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}): React.JSX.Element {
  const store = useMemo(() => createStore(), []);
  useEffect(() => (enabled ? store.start() : undefined), [store, enabled]);
  return <NotificationContext.Provider value={store}>{children}</NotificationContext.Provider>;
}
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { data } = authClient.useSession();
  const key = data ? `${data.user.id}:${data.session.id}` : "anonymous";
  return (
    <SessionStore key={key} enabled={Boolean(data)}>
      {children}
    </SessionStore>
  );
}

export { NotificationStoreProvider, useNotifications } from "./notification-context";
