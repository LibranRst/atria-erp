"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-create-user-batch-proposal";

export async function confirmAiCreateUserBatchProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-create-user-batch-proposal.confirmAiCreateUserBatchProposal">
): Promise<
  WebRpcResult<"app/actions/ai/confirm-create-user-batch-proposal.confirmAiCreateUserBatchProposal">
> {
  return callBackendAction(
    "app/actions/ai/confirm-create-user-batch-proposal.confirmAiCreateUserBatchProposal",
    args,
    { allowCookieWrites: true },
  );
}
