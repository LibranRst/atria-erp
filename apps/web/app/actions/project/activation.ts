"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/activation";

export async function activateProjectAction(
  ...args: WebRpcArgs<"app/actions/project/activation.activateProjectAction">
): Promise<WebRpcResult<"app/actions/project/activation.activateProjectAction">> {
  return callBackendAction("app/actions/project/activation.activateProjectAction", args, {
    allowCookieWrites: true,
  });
}
