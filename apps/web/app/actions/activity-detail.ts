"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/activity-detail";

export async function getActivityDetail(
  ...args: WebRpcArgs<"app/actions/activity-detail.getActivityDetail">
): Promise<WebRpcResult<"app/actions/activity-detail.getActivityDetail">> {
  return callBackendAction("app/actions/activity-detail.getActivityDetail", args, {
    allowCookieWrites: true,
  });
}
