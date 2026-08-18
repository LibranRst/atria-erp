import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function QueryProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 30 * 60 * 1000,
            retry: 1,
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  useEffect(() => {
    return onlineManager.setEventListener((setOnline) => {
      void Network.getNetworkStateAsync().then((state) => {
        setOnline(state.isConnected === true && state.isInternetReachable !== false);
      });

      const subscription = Network.addNetworkStateListener((state) => {
        setOnline(state.isConnected === true && state.isInternetReachable !== false);
      });

      return () => subscription.remove();
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (process.env.EXPO_OS !== "web") focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
