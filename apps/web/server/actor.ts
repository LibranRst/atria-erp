import "server-only";

import { cache } from "react";
import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/server/actor";

/*
 * Root layout dan page sama-sama membutuhkan actor pada render yang sama.
 * `cache` membuat keduanya berbagi satu RPC per request; request berikutnya
 * (navigasi, refresh, revalidasi) tetap membaca actor yang segar.
 */
export const resolveActor = cache(
  async (
    ...args: WebRpcArgs<"server/actor.resolveActor">
  ): Promise<WebRpcResult<"server/actor.resolveActor">> => {
    return callBackend("server/actor.resolveActor", args);
  },
);
