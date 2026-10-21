"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-material-proposal";

export async function confirmAiGoodsReceiptProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-material-proposal.confirmAiGoodsReceiptProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-material-proposal.confirmAiGoodsReceiptProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-material-proposal.confirmAiGoodsReceiptProposal",
    args,
    { allowCookieWrites: true },
  );
}
