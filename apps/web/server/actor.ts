import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/server/actor";

export async function resolveActor(
  ...args: WebRpcArgs<"server/actor.resolveActor">
): Promise<WebRpcResult<"server/actor.resolveActor">> {
  return callBackend("server/actor.resolveActor", args);
}
