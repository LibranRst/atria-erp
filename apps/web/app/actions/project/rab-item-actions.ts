"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/rab-item-actions";

export async function updateRabEstimateItem(
  ...args: WebRpcArgs<"app/actions/project/rab-item-actions.updateRabEstimateItem">
): Promise<WebRpcResult<"app/actions/project/rab-item-actions.updateRabEstimateItem">> {
  return callBackendAction("app/actions/project/rab-item-actions.updateRabEstimateItem", args, {
    allowCookieWrites: true,
  });
}
