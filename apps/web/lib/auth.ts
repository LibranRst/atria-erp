import "server-only";

import type { ServerSession } from "@atria/api/contract";
import { readBackendSession } from "@/lib/api/session";

interface SessionRequest {
  readonly headers: Headers | Readonly<Record<string, string | undefined>>;
}

/** Compatibility for session-only callers. The auth runtime and DB belong to apps/api. */
export const auth = {
  api: {
    async getSession(input: SessionRequest): Promise<ServerSession> {
      const headers = input.headers instanceof Headers ? input.headers : new Headers();
      if (!(input.headers instanceof Headers)) {
        for (const [name, value] of Object.entries(input.headers)) {
          if (value !== undefined) headers.set(name, value);
        }
      }
      return readBackendSession(headers);
    },
  },
};
