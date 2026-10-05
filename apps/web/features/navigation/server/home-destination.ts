import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/navigation/server/home-destination";

export async function resolveHomeDestination(
  ...args: WebRpcArgs<"features/navigation/server/home-destination.resolveHomeDestination">
): Promise<WebRpcResult<"features/navigation/server/home-destination.resolveHomeDestination">> {
  return callBackend("features/navigation/server/home-destination.resolveHomeDestination", args);
}
