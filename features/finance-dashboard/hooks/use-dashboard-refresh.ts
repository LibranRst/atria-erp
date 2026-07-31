"use client";

import { useRouter } from "next/navigation";
import React from "react";

export const DASHBOARD_AUTO_REFRESH_AFTER_MS = 5 * 60_000;
export const DASHBOARD_REFRESH_COOLDOWN_MS = 60_000;

type RefreshReason = "manual" | "online" | "passive";

type ShouldAutoRefreshDashboardInput = {
  readonly generatedAt: string | Date;
  readonly currentTime: Date;
  readonly lastAttemptAt: number | null;
};

export type DashboardRefreshControl = {
  readonly online: boolean;
  readonly refreshFailed: boolean;
  readonly refreshing: boolean;
  readonly refresh: () => void;
};

function timestamp(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

function subscribeToConnectivity(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

export function shouldAutoRefreshDashboard({
  generatedAt,
  currentTime,
  lastAttemptAt,
}: ShouldAutoRefreshDashboardInput): boolean {
  const now = currentTime.getTime();
  const snapshotAge = Math.max(0, now - timestamp(generatedAt));
  const cooldownElapsed =
    lastAttemptAt === null || now - lastAttemptAt >= DASHBOARD_REFRESH_COOLDOWN_MS;
  return snapshotAge >= DASHBOARD_AUTO_REFRESH_AFTER_MS && cooldownElapsed;
}

export function useDashboardRefresh(generatedAt: string | Date): DashboardRefreshControl {
  const router = useRouter();
  const [refreshing, startRefresh] = React.useTransition();
  const [refreshFailed, setRefreshFailed] = React.useState(false);
  const online = React.useSyncExternalStore(
    subscribeToConnectivity,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );
  const generatedAtTimestamp = timestamp(generatedAt);
  const attemptedGeneratedAtRef = React.useRef<number | null>(null);
  const lastAttemptAtRef = React.useRef<number | null>(null);
  const activeAttemptRef = React.useRef(false);
  const sawPendingRef = React.useRef(false);

  const attemptRefresh = React.useCallback(
    (reason: RefreshReason): void => {
      if (activeAttemptRef.current) return;

      const now = new Date();
      const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!isOnline) {
        setRefreshFailed(true);
        return;
      }

      if (
        reason === "passive" &&
        !shouldAutoRefreshDashboard({
          generatedAt: new Date(generatedAtTimestamp),
          currentTime: now,
          lastAttemptAt: lastAttemptAtRef.current,
        })
      ) {
        return;
      }

      if (
        reason === "online" &&
        lastAttemptAtRef.current !== null &&
        now.getTime() - lastAttemptAtRef.current < DASHBOARD_REFRESH_COOLDOWN_MS
      ) {
        return;
      }

      activeAttemptRef.current = true;
      attemptedGeneratedAtRef.current = generatedAtTimestamp;
      lastAttemptAtRef.current = now.getTime();
      setRefreshFailed(false);
      startRefresh((): void => router.refresh());
    },
    [generatedAtTimestamp, router],
  );

  React.useEffect(() => {
    if (refreshing) {
      sawPendingRef.current = true;
      return;
    }
    if (!sawPendingRef.current) return;

    sawPendingRef.current = false;
    activeAttemptRef.current = false;
    const attemptedGeneratedAt = attemptedGeneratedAtRef.current;
    attemptedGeneratedAtRef.current = null;
    setRefreshFailed(
      attemptedGeneratedAt !== null && attemptedGeneratedAt === generatedAtTimestamp,
    );
  }, [generatedAtTimestamp, refreshing]);

  React.useEffect(() => {
    const handlePassiveRefresh = (): void => {
      if (document.visibilityState === "visible") attemptRefresh("passive");
    };
    const handleOnline = (): void => {
      attemptRefresh("online");
    };

    window.addEventListener("focus", handlePassiveRefresh);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handlePassiveRefresh);
    return () => {
      window.removeEventListener("focus", handlePassiveRefresh);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handlePassiveRefresh);
    };
  }, [attemptRefresh]);

  return {
    online,
    refreshing,
    refreshFailed,
    refresh: (): void => attemptRefresh("manual"),
  };
}
