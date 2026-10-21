"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-create-user-proposal";

export async function confirmAiCreateUserProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-create-user-proposal.confirmAiCreateUserProposal">
): Promise<
  WebRpcResult<"app/actions/ai/confirm-create-user-proposal.confirmAiCreateUserProposal">
> {
  return callBackendAction(
    "app/actions/ai/confirm-create-user-proposal.confirmAiCreateUserProposal",
    args,
    { allowCookieWrites: true },
  );
}
