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
import { createNotificationEnvironment } from "./notification-environment";
import { startPushNotificationRead } from "./push-notification-read";
function createStore(): ReturnType<typeof createNotificationStore> {
  return createNotificationStore(
    {
      open: openNotificationAction,
      summary: getNotificationsAction,
      list: listNotificationsAction,
      mark: markNotificationReadAction,
      markAll: markAllNotificationsReadAction,
    },
    createNotificationEnvironment((message: string): void => {
      toast.error(message);
    }),
  );
}
function SessionStore({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | null;
}): React.JSX.Element {
  const store = useMemo(() => createStore(), []);
  useEffect(() => (userId ? store.start() : undefined), [store, userId]);
  useEffect(
    () =>
      startPushNotificationRead({
        userId,
        markRead: markNotificationReadAction,
        onRead: store.invalidate,
      }),
    [store, userId],
  );
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
    <SessionStore key={key} userId={data?.user.id ?? null}>
      {children}
    </SessionStore>
  );
}

export { NotificationStoreProvider, useNotifications } from "./notification-context";
