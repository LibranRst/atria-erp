"use server";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/auth-navigation";

export async function getPostLoginRedirectDestination(
  ...args: WebRpcArgs<"app/actions/auth-navigation.getPostLoginRedirectDestination">
): Promise<WebRpcResult<"app/actions/auth-navigation.getPostLoginRedirectDestination">> {
  return callBackend("app/actions/auth-navigation.getPostLoginRedirectDestination", args, {
    allowCookieWrites: true,
  });
}
