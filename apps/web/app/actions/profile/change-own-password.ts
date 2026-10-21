"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/profile/change-own-password";

export async function changeOwnPassword(
  ...args: WebRpcArgs<"app/actions/profile/change-own-password.changeOwnPassword">
): Promise<WebRpcResult<"app/actions/profile/change-own-password.changeOwnPassword">> {
  return callBackendAction("app/actions/profile/change-own-password.changeOwnPassword", args, {
    allowCookieWrites: true,
  });
}
