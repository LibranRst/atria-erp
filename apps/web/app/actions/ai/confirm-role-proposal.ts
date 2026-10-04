"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-role-proposal";

export async function confirmAiRoleChangeProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-role-proposal.confirmAiRoleChangeProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-role-proposal.confirmAiRoleChangeProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-role-proposal.confirmAiRoleChangeProposal",
    args,
    { allowCookieWrites: true },
  );
}
