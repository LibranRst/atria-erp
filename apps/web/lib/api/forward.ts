import "server-only";

import { getBackendConnection } from "./config";
import { forwardBackendRequest } from "./http";

export async function forwardToBackend(request: Request): Promise<Response> {
  return forwardBackendRequest({ request, connection: getBackendConnection() });
}
