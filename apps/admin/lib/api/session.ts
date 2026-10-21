import "server-only";
import type { ServerSession } from "@atria/api/contract";
import { readBackendSession as readSessionHTTP } from "@atria/api-client";
import { getBackendConnection } from "./config";
import { adminBackendHeaders } from "./admin-cookies";

export async function readBackendSession(requestHeaders: Headers): Promise<ServerSession> {
  return readSessionHTTP({
    connection: getBackendConnection(),
    headers: adminBackendHeaders(requestHeaders),
  });
}
