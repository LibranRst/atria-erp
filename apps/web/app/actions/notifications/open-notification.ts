"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/notifications/open-notification";

export async function openNotificationAction(
  ...args: WebRpcArgs<"app/actions/notifications/open-notification.openNotificationAction">
): Promise<WebRpcResult<"app/actions/notifications/open-notification.openNotificationAction">> {
  return callBackendAction(
    "app/actions/notifications/open-notification.openNotificationAction",
    args,
    { allowCookieWrites: true },
  );
}
