import { onlineManager, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/providers/auth-provider";
import { isAccessRevoked } from "./access-error";
import { acceptScreenData, screenQueryKey } from "./screen-query-state";

const subscribeOnline = (notify: () => void): (() => void) => onlineManager.subscribe(notify);
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function useScreenQuery<T>(
  name: string,
  load: (signal: AbortSignal) => Promise<T>,
  params: readonly unknown[] = [],
  enabled = true,
): UseQueryResult<T, Error> & {
  readonly isRefreshing: boolean;
  readonly refresh: () => Promise<void>;
} {
  const { cacheScope, user } = useAuth();
  const focused = useIsFocused();
  const online = useOnline();
  const [isRefreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: screenQueryKey(cacheScope, name, params),
    queryFn: async ({ signal }) => acceptScreenData(await load(signal)),
    enabled: Boolean(user) && enabled && focused,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: (count, error) => !isAccessRevoked(error) && count < 1,
  });
  const { refetch } = query;
  const refresh = useCallback(async (): Promise<void> => {
    // No queued refresh spinner while the device is offline.
    if (!online || !enabled) return;
    setRefreshing(true);
    try {
      await refetch({ cancelRefetch: false });
    } finally {
      setRefreshing(false);
    }
  }, [enabled, online, refetch]);
  return { ...query, isRefreshing, refresh };
}
