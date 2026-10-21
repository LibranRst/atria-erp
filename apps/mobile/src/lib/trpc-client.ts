import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { onlineManager } from "@tanstack/react-query";

import { getSessionBearerToken } from "@/lib/auth-client";
import { getApiBaseURL } from "@/lib/runtime-config";
import type { AppRouter } from "@atria/api/contract";

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: `${getApiBaseURL()}/api/trpc`,
      async fetch(url, options): Promise<Response> {
        // tRPC sends mutations with POST. No offline money/form write queue.
        if (options?.method === "POST" && !onlineManager.isOnline()) {
          throw new Error("Perangkat sedang offline. Hubungkan ke internet lalu coba lagi.");
        }
        return fetch(url, options);
      },
      headers(): Record<string, string> {
        const token = getSessionBearerToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
