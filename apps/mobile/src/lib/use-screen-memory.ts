import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useAuth } from "@/providers/auth-provider";

export function useScreenSelection<T extends string>(
  page: string,
  initial: T,
): readonly [T, (value: T) => void] {
  const client = useQueryClient();
  const { cacheScope } = useAuth();
  const key = useMemo(() => ["ui", page, "selection", cacheScope], [cacheScope, page]);
  const subscribe = useCallback(
    (notify: () => void) => client.getQueryCache().subscribe(notify),
    [client],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => client.getQueryData<T>(key) ?? initial,
    () => initial,
  );
  const select = useCallback(
    (next: T): void => {
      client.setQueryData(key, next);
    },
    [client, key],
  );
  return [value, select];
}

export function useScreenScroll(page: string): {
  readonly contentOffset: { readonly x: number; readonly y: number };
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly scrollEventThrottle: number;
} {
  const client = useQueryClient();
  const { cacheScope } = useAuth();
  const key = useMemo(() => ["ui", page, "scroll", cacheScope], [cacheScope, page]);
  const [contentOffset] = useState(() => ({ x: 0, y: client.getQueryData<number>(key) ?? 0 }));
  const offset = useRef(contentOffset.y);
  useFocusEffect(
    useCallback(
      () => () => {
        client.setQueryData(key, offset.current);
      },
      [client, key],
    ),
  );
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    // Remember on blur; don't write to React/cache on every scrolling frame.
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);
  return { contentOffset, onScroll, scrollEventThrottle: 32 };
}
