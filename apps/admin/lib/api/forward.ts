import "server-only";
import { forwardBackendRequest } from "@atria/api-client";
import { getBackendConnection } from "./config";
import { adminBackendHeaders, adminResponseHeaders } from "./admin-cookies";

export async function forwardToBackend(request: Request): Promise<Response> {
  const response = await forwardBackendRequest({
    request: new Request(request, { headers: adminBackendHeaders(request.headers) }),
    connection: getBackendConnection(),
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: adminResponseHeaders(response.headers),
  });
}
