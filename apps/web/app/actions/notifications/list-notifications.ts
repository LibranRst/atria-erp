"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/notifications/list-notifications";

export async function listNotificationsAction(
  ...args: WebRpcArgs<"app/actions/notifications/list-notifications.listNotificationsAction">
): Promise<WebRpcResult<"app/actions/notifications/list-notifications.listNotificationsAction">> {
  return callBackendAction(
    "app/actions/notifications/list-notifications.listNotificationsAction",
    args,
    { allowCookieWrites: true },
  );
}
