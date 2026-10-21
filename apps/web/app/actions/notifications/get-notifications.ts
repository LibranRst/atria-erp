"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/notifications/get-notifications";

export async function getNotificationsAction(
  ...args: WebRpcArgs<"app/actions/notifications/get-notifications.getNotificationsAction">
): Promise<WebRpcResult<"app/actions/notifications/get-notifications.getNotificationsAction">> {
  return callBackendAction(
    "app/actions/notifications/get-notifications.getNotificationsAction",
    args,
    { allowCookieWrites: true },
  );
}
