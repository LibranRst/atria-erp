"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/media/sign-imagekit";

export async function signImagekit(
  ...args: WebRpcArgs<"app/actions/media/sign-imagekit.signImagekit">
): Promise<WebRpcResult<"app/actions/media/sign-imagekit.signImagekit">> {
  return callBackendAction("app/actions/media/sign-imagekit.signImagekit", args, {
    allowCookieWrites: true,
  });
}
