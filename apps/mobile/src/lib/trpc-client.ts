import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import { getSessionBearerToken } from "@/lib/auth-client";
import { getApiBaseURL } from "@/lib/runtime-config";
import type { AppRouter } from "@atria/web/api";

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: `${getApiBaseURL()}/api/trpc`,
      headers(): Record<string, string> {
        const token = getSessionBearerToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
