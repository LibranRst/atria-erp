"use client";
import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { createNotificationStore, type NotificationStoreState } from "./notification-store";
export const NotificationContext = createContext<ReturnType<typeof createNotificationStore> | null>(
  null,
);
export function NotificationStoreProvider({
  store,
  children,
}: {
  store: ReturnType<typeof createNotificationStore>;
  children: React.ReactNode;
}): React.JSX.Element {
  useEffect(() => store.start(), [store]);
  return <NotificationContext.Provider value={store}>{children}</NotificationContext.Provider>;
}
export function useNotifications(): NotificationStoreState &
  Pick<
    ReturnType<typeof createNotificationStore>,
    "openNotification" | "refresh" | "loadMore" | "markAsRead" | "markAllAsRead"
  > {
  const store = useContext(NotificationContext);
  if (!store) throw new Error("NotificationsProvider is required");
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return {
    ...state,
    openNotification: store.openNotification,
    refresh: store.refresh,
    loadMore: store.loadMore,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
  };
}
