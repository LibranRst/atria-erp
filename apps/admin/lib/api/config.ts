import "server-only";
import { readBackendConnection, type BackendConnection } from "@atria/api-client";

export function getBackendConnection(): BackendConnection {
  return readBackendConnection(process.env);
}
