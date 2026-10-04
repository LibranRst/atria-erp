"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/notifications/push-token";

export async function registerPushTokenAction(
  ...args: WebRpcArgs<"app/actions/notifications/push-token.registerPushTokenAction">
): Promise<WebRpcResult<"app/actions/notifications/push-token.registerPushTokenAction">> {
  return callBackendAction("app/actions/notifications/push-token.registerPushTokenAction", args, {
    allowCookieWrites: true,
  });
}

export async function unregisterPushTokenAction(
  ...args: WebRpcArgs<"app/actions/notifications/push-token.unregisterPushTokenAction">
): Promise<WebRpcResult<"app/actions/notifications/push-token.unregisterPushTokenAction">> {
  return callBackendAction("app/actions/notifications/push-token.unregisterPushTokenAction", args, {
    allowCookieWrites: true,
  });
}
