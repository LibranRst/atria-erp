"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/notifications/mark-read";

export async function markNotificationReadAction(
  ...args: WebRpcArgs<"app/actions/notifications/mark-read.markNotificationReadAction">
): Promise<WebRpcResult<"app/actions/notifications/mark-read.markNotificationReadAction">> {
  return callBackendAction("app/actions/notifications/mark-read.markNotificationReadAction", args, {
    allowCookieWrites: true,
  });
}

export async function markAllNotificationsReadAction(
  ...args: WebRpcArgs<"app/actions/notifications/mark-read.markAllNotificationsReadAction">
): Promise<WebRpcResult<"app/actions/notifications/mark-read.markAllNotificationsReadAction">> {
  return callBackendAction(
    "app/actions/notifications/mark-read.markAllNotificationsReadAction",
    args,
    { allowCookieWrites: true },
  );
}
