"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/rap-rab-approval";

export async function approveRabEstimate(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-approval.approveRabEstimate">
): Promise<WebRpcResult<"app/actions/project/rap-rab-approval.approveRabEstimate">> {
  return callBackendAction("app/actions/project/rap-rab-approval.approveRabEstimate", args, {
    allowCookieWrites: true,
  });
}
