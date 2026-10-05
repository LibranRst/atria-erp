"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/revision-change-order-approval";

export async function approveProjectChangeOrder(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order-approval.approveProjectChangeOrder">
): Promise<
  WebRpcResult<"app/actions/project/revision-change-order-approval.approveProjectChangeOrder">
> {
  return callBackendAction(
    "app/actions/project/revision-change-order-approval.approveProjectChangeOrder",
    args,
    { allowCookieWrites: true },
  );
}
